routerAdd(
  'POST',
  '/backend/v1/analise-duplicidade/submit',
  (e) => {
    const payload = e.requestInfo().body

    if (!payload.file_name || !payload.file_base64) {
      throw new BadRequestError('file_name and file_base64 are required')
    }

    const collection = $app.findCollectionByNameOrId('analises_duplicidade')
    const record = new Record(collection)
    record.set('file_name', payload.file_name)
    record.set('status', 'processing')
    if (e.auth) {
      record.set('uploaded_by', e.auth.id)
    }

    // Save initially to get an ID for request_id
    $app.save(record)

    const boundary = '----WebKitFormBoundary' + $security.randomString(16)
    let reqBody = ''

    reqBody += '--' + boundary + '\r\n'
    reqBody += 'Content-Disposition: form-data; name="request_id"\r\n\r\n'
    reqBody += record.id + '\r\n'

    reqBody += '--' + boundary + '\r\n'
    reqBody +=
      'Content-Disposition: form-data; name="file"; filename="' + payload.file_name + '"\r\n'
    reqBody += 'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n'
    reqBody += 'Content-Transfer-Encoding: base64\r\n\r\n'
    reqBody += payload.file_base64 + '\r\n'

    reqBody += '--' + boundary + '--\r\n'

    try {
      // This performs a strictly synchronous/blocking request in the Goja VM.
      // It will wait for the n8n workflow to complete before continuing.
      const res = $http.send({
        url: 'https://prndiag1.app.n8n.cloud/webhook/analise-duplicidade-process',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
        },
        body: reqBody,
        timeout: 300, // 5 minutes timeout to ensure we wait for AI processing
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const responseData = res.json || {}

        if (responseData.error) {
          record.set('status', 'error')
          record.set(
            'error_code',
            responseData.error_code || responseData.errorCode || 'WORKFLOW_ERROR',
          )
          record.set(
            'error_message',
            responseData.error_message ||
              responseData.errorMessage ||
              responseData.message ||
              'Erro retornado pela análise.',
          )
        } else {
          try {
            const data = responseData.result || responseData
            const summary = data.summary || data

            record.set('status', 'completed')
            record.set('result_json', data)

            record.set('total_records', summary.totalRecords ?? summary.total_records ?? 0)
            record.set(
              'analyzable_records',
              summary.analyzableRecords ?? summary.analyzable_records ?? 0,
            )
            record.set('duplicate_count', summary.duplicateCount ?? summary.duplicate_count ?? 0)
            record.set(
              'manual_review_count',
              summary.manualReviewCount ?? summary.manual_review_count ?? 0,
            )
            record.set(
              'name_repeat_manual_count',
              summary.nameRepeatManualCount ?? summary.name_repeat_manual_count ?? 0,
            )
            record.set('group_count', summary.groupCount ?? summary.group_count ?? 0)
            record.set(
              'manual_group_count',
              summary.manualGroupCount ?? summary.manual_group_count ?? 0,
            )
            record.set(
              'name_repeat_manual_group_count',
              summary.nameRepeatManualGroupCount ?? summary.name_repeat_manual_group_count ?? 0,
            )
            record.set(
              'overall_manual_count',
              summary.overallManualCount ?? summary.overall_manual_count ?? 0,
            )
            record.set(
              'overall_manual_group_count',
              summary.overallManualGroupCount ?? summary.overall_manual_group_count ?? 0,
            )
            record.set(
              'partial_structure_count',
              summary.partialStructureCount ?? summary.partial_structure_count ?? 0,
            )
          } catch (mappingErr) {
            record.set('status', 'error')
            record.set('error_code', 'MAPPING_ERROR')
            record.set(
              'error_message',
              mappingErr.message || 'Erro ao mapear a resposta da análise.',
            )
          }
        }
      } else {
        const errData = res.json || {}
        record.set('status', 'error')
        record.set(
          'error_code',
          errData.error_code || errData.errorCode || res.statusCode.toString(),
        )
        record.set(
          'error_message',
          errData.error_message ||
            errData.errorMessage ||
            errData.message ||
            'Erro no processamento da análise.',
        )
      }
    } catch (err) {
      record.set('status', 'error')
      record.set('error_code', 'WEBHOOK_TIMEOUT')
      record.set('error_message', err.message || 'O webhook excedeu o tempo limite ou falhou.')
    }

    // Persist final execution results
    $app.save(record)
    $app.expandRecord(record, ['uploaded_by'])

    // Respond only when fully complete
    return e.json(200, record)
  },
  $apis.requireAuth(),
)
