routerAdd(
  'POST',
  '/backend/v1/prn/report-json',
  (e) => {
    const body = e.requestInfo().body || {}
    const auth = e.auth

    const dailyBase64 = body.daily_file_base64 || ''
    const historicalBase64 = body.historical_file_base64 || ''
    const dailyFilename = body.daily_filename || 'daily.xlsx'
    const historicalFilename = body.historical_filename || 'historical.xlsx'
    const refDate = body.reference_date || ''

    if (!dailyBase64 || !historicalBase64) {
      return e.badRequestError('Arquivos diário e histórico são obrigatórios (base64).')
    }

    const runs = $app.findCollectionByNameOrId('prn_report_runs')
    const record = new Record(runs)
    record.set('status', 'processing')
    record.set('daily_filename', dailyFilename)
    record.set('historical_filename', historicalFilename)
    if (refDate) record.set('data_referencia', refDate)
    if (auth) record.set('user_id', auth.id)
    $app.save(record)

    const startTime = Date.now()

    try {
      const boundary = '----PocketBaseFormBoundary' + $security.randomString(16)
      const newLine = '\r\n'
      let bodyStr = ''

      function appendField(name, value) {
        bodyStr += '--' + boundary + newLine
        bodyStr += 'Content-Disposition: form-data; name="' + name + '"' + newLine + newLine
        bodyStr += value + newLine
      }

      function appendFileBase64(name, filename, base64Value) {
        bodyStr += '--' + boundary + newLine
        bodyStr +=
          'Content-Disposition: form-data; name="' +
          name +
          '"; filename="' +
          filename +
          '"' +
          newLine
        bodyStr += 'Content-Type: application/octet-stream' + newLine
        bodyStr += 'Content-Transfer-Encoding: base64' + newLine + newLine
        bodyStr += base64Value + newLine
      }

      appendFileBase64('daily_file', dailyFilename, dailyBase64)
      appendFileBase64('historical_file', historicalFilename, historicalBase64)
      appendField('daily_filename', dailyFilename)
      appendField('historical_filename', historicalFilename)
      if (refDate) appendField('reference_date', refDate)
      appendField('daily_file_base64', dailyBase64)
      appendField('historical_file_base64', historicalBase64)

      bodyStr += '--' + boundary + '--' + newLine

      const res = $http.send({
        url: 'https://prndiag1.app.n8n.cloud/webhook/prn/report',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
        },
        body: bodyStr,
        timeout: 120,
      })

      const durationMs = Date.now() - startTime

      if (res.statusCode !== 200) {
        record.set('status', 'error')
        record.set('error_code', 'WEBHOOK_UPSTREAM_ERROR')
        record.set(
          'error_message',
          'Falha na comunicação com o motor de análise. Status: ' + res.statusCode,
        )
        record.set('duration_ms', durationMs)

        let details = 'Nenhum detalhe adicional.'
        try {
          if (res.json) details = JSON.stringify(res.json)
          else if (res.body) {
            const arr = new Uint8Array(res.body)
            details = ''
            for (let i = 0; i < arr.length && i < 500; i++) {
              details += String.fromCharCode(arr[i])
            }
          }
        } catch (e) {}

        $app.save(record)
        return e.json(res.statusCode, {
          ok: false,
          error: {
            code: 'WEBHOOK_UPSTREAM_ERROR',
            message: 'Falha na comunicação com o motor de análise. Status: ' + res.statusCode,
            details: details,
          },
          meta: {
            requestId: record.id,
          },
        })
      }

      const jsonRes = res.json || {}

      let reportModel = {
        summary: {},
        entities: [],
        expenses: [],
        receipts: [],
        crossAnalysis: [],
      }

      if (!res.json) {
        let htmlStr = ''
        try {
          if (res.body) {
            const arr = new Uint8Array(res.body)
            for (let i = 0; i < arr.length && i < 200000; i++) {
              htmlStr += String.fromCharCode(arr[i])
            }
          }
        } catch (e) {}
        reportModel.type = 'legacy_html'
        reportModel.html = htmlStr
        record.set('response_html', htmlStr)
      } else {
        if (jsonRes.html) {
          reportModel.type = 'legacy_html'
          reportModel.html = jsonRes.html
          record.set('response_html', jsonRes.html)
        } else {
          reportModel = Object.assign(reportModel, jsonRes.reportModel || jsonRes)
        }
      }

      const finalData = {
        ok: true,
        reportModel: reportModel,
        meta: {
          requestId: record.id,
          durationMs: durationMs,
          generatedAt: new Date().toISOString(),
          ...(jsonRes.meta || {}),
        },
      }

      record.set('status', 'success')
      record.set('meta', finalData.meta)
      record.set('result_json', reportModel)
      record.set('duration_ms', durationMs)
      $app.save(record)

      return e.json(200, finalData)
    } catch (err) {
      const durationMs = Date.now() - startTime
      record.set('status', 'error')
      record.set('error_code', 'WEBHOOK_UPSTREAM_ERROR')
      record.set('error_message', String(err))
      record.set('duration_ms', durationMs)
      $app.save(record)

      return e.json(500, {
        ok: false,
        error: {
          code: 'WEBHOOK_UPSTREAM_ERROR',
          message: 'Erro interno ao processar a análise: ' + String(err),
          details: String(err),
        },
        meta: {
          requestId: record.id,
        },
      })
    }
  },
  $apis.requireAuth(),
)
