routerAdd(
  'POST',
  '/backend/v1/prn/submit',
  (e) => {
    const start = Date.now()
    console.log(`[PRN] Execution started by user ${e.auth?.id || 'anonymous'}`)

    const body = e.requestInfo().body || {}
    const dailyFiles = e.findUploadedFiles('daily_file') || []
    const historicalFiles = e.findUploadedFiles('historical_file') || []

    // 1. Validation Rules
    if (dailyFiles.length === 0) {
      return e.json(400, {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing daily_file' },
      })
    }
    if (historicalFiles.length === 0) {
      return e.json(400, {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing historical_file' },
      })
    }

    const dFile = dailyFiles[0]
    const hFile = historicalFiles[0]

    const dName =
      dFile.originalName || dFile.OriginalName || dFile.name || dFile.Name || 'daily.xlsx'
    const hName =
      hFile.originalName || hFile.OriginalName || hFile.name || hFile.Name || 'historical.xlsx'

    if (!dName.toLowerCase().endsWith('.xlsx') || !hName.toLowerCase().endsWith('.xlsx')) {
      return e.json(400, {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Files must have .xlsx extension' },
      })
    }

    const dSize = dFile.size || dFile.Size || 0
    const hSize = hFile.size || hFile.Size || 0
    const MAX_SIZE = 10 * 1024 * 1024

    if (dSize > MAX_SIZE || hSize > MAX_SIZE) {
      return e.json(400, {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'File size exceeds 10MB limit' },
      })
    }

    const dBase64 = body.daily_file_base64 || ''
    const hBase64 = body.historical_file_base64 || ''

    if (!dBase64 || !hBase64) {
      return e.json(400, {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing base64 content for forwarding' },
      })
    }

    // 2. Webhook Integration Prep
    const boundary = '----WebKitFormBoundary' + $security.randomString(16)
    let multipartBody = ''

    function appendField(key, value) {
      if (value) {
        multipartBody += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      }
    }

    function appendFile(key, filename, mime, base64) {
      multipartBody += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${filename}"\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n`
    }

    appendField('reference_date', body.reference_date)
    appendFile(
      'daily_file',
      dName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dBase64,
    )
    appendFile(
      'historical_file',
      hName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      hBase64,
    )
    multipartBody += `--${boundary}--\r\n`

    const webhookUrl = 'https://prndiag1.app.n8n.cloud/webhook/prn/report'

    // 3. Create Persistence Record (Audit Trial)
    let runRecordId = null
    try {
      const prnRunsCol = $app.findCollectionByNameOrId('prn_report_runs')
      const runRecord = new Record(prnRunsCol)
      runRecord.set('status', 'processing')
      runRecord.set('daily_filename', dName)
      runRecord.set('historical_filename', hName)
      runRecord.set('webhook_url', webhookUrl)
      if (e.auth) runRecord.set('user_id', e.auth.id)
      if (body.reference_date) runRecord.set('data_referencia', body.reference_date)

      $app.save(runRecord)
      runRecordId = runRecord.id
    } catch (dbErr) {
      console.log('[PRN] DB Create Run Error:', dbErr)
    }

    // 4. Send Webhook
    const webhookStart = Date.now()
    const res = $http.send({
      url: webhookUrl,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipartBody,
      timeout: 120,
    })
    const duration = Date.now() - webhookStart

    // 5. Response Normalization
    let isError = false
    let htmlContent = ''
    let errorCode = ''
    let errorMessage = ''
    let errorDetails = ''

    if (res.statusCode >= 400 || res.statusCode === 0) {
      isError = true
      errorCode = 'WEBHOOK_UPSTREAM_ERROR'
      errorMessage = 'Falha ao processar planilhas no servico de relatorio.'
      errorDetails = `HTTP ${res.statusCode || 'Timeout'}`
    } else {
      const contentType = (
        res.headers['content-type'] ||
        res.headers['Content-Type'] ||
        ''
      ).toLowerCase()
      if (contentType.includes('text/html')) {
        htmlContent = res.string
      } else if (contentType.includes('application/json')) {
        const payload = res.json || {}
        if (Array.isArray(payload) && payload[0]?.html) {
          htmlContent = payload[0].html
        } else if (payload.html) {
          htmlContent = payload.html
        } else if (payload.payload && Array.isArray(payload.payload) && payload[0]?.html) {
          htmlContent = payload.payload[0].html
        } else if (payload.payload?.html) {
          htmlContent = payload.payload.html
        }
      }

      if (!htmlContent || !htmlContent.trim().startsWith('<')) {
        isError = true
        errorCode = 'INVALID_WEBHOOK_RESPONSE'
        errorMessage = 'O webhook nao retornou um HTML valido.'
        errorDetails = res.string ? res.string.substring(0, 200) : 'Empty response'
      }
    }

    // 6. Update Persistence Record
    if (runRecordId) {
      try {
        const runRecord = $app.findRecordById('prn_report_runs', runRecordId)
        runRecord.set('duration_ms', duration)
        runRecord.set('webhook_http_status', res.statusCode || 0)

        if (isError) {
          runRecord.set('status', 'error')
          runRecord.set('error_code', errorCode)
          runRecord.set('error_message', errorMessage)
          runRecord.set('meta', { details: errorDetails })
        } else {
          runRecord.set('status', 'success')
          runRecord.set(
            'webhook_content_type',
            res.headers['content-type'] || res.headers['Content-Type'] || '',
          )
          runRecord.set('response_html', htmlContent)
        }
        $app.save(runRecord)
      } catch (updateErr) {
        console.log('[PRN] DB Update Run Error:', updateErr)
      }
    }

    const totalDuration = Date.now() - start
    console.log(
      `[PRN] Execution finished in ${totalDuration}ms with status ${isError ? 'ERROR' : 'SUCCESS'}`,
    )

    // 7. Standardized Responses
    if (isError) {
      const outStatus = res.statusCode > 0 && res.statusCode < 600 ? res.statusCode : 500
      return e.json(outStatus, {
        ok: false,
        error: { code: errorCode, message: errorMessage, details: errorDetails },
      })
    }

    return e.json(200, {
      ok: true,
      html: htmlContent,
      meta: {
        webhookStatus: res.statusCode,
        contentType: res.headers['content-type'] || res.headers['Content-Type'],
      },
    })
  },
  $apis.requireAuth(),
)
