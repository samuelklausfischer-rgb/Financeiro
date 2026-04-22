routerAdd(
  'GET',
  '/backend/v1/analise-duplicidade/{id}',
  (e) => {
    const id = e.request.pathValue('id')
    try {
      const record = $app.findRecordById('analises_duplicidade', id)
      $apis.enrichRecord(e, record, 'uploaded_by')
      return e.json(200, record)
    } catch (err) {
      throw new NotFoundError('Análise não encontrada.')
    }
  },
  $apis.requireAuth(),
)
