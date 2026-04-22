routerAdd(
  'GET',
  '/backend/v1/analise-duplicidade/history',
  (e) => {
    const page = parseInt(e.request.url.query().get('page') || '1')
    const perPage = parseInt(e.request.url.query().get('perPage') || '20')
    const status = e.request.url.query().get('status') || 'all'
    const search = e.request.url.query().get('search') || ''
    const startDate = e.request.url.query().get('startDate') || ''
    const endDate = e.request.url.query().get('endDate') || ''

    let filter = "id != ''"
    const params = {}

    if (status && status !== 'all') {
      filter += ' && status = {:status}'
      params.status = status
    }
    if (search) {
      filter += ' && file_name ~ {:search}'
      params.search = search
    }
    if (startDate) {
      filter += ' && created >= {:startDate}'
      params.startDate = startDate + ' 00:00:00.000Z'
    }
    if (endDate) {
      filter += ' && created <= {:endDate}'
      params.endDate = endDate + ' 23:59:59.999Z'
    }

    const offset = (page - 1) * perPage
    const records = $app.findRecordsByFilter(
      'analises_duplicidade',
      filter,
      '-created',
      perPage + 1,
      offset,
      params,
    )

    const hasMore = records.length > perPage
    if (hasMore) records.pop()

    const items = records.map((r) => {
      const obj = r.publicExport()
      delete obj.result_json
      try {
        if (obj.uploaded_by) {
          const user = $app.findRecordById('users', obj.uploaded_by)
          obj.expand = { uploaded_by: { name: user.get('name'), email: user.get('email') } }
        }
      } catch (_) {}
      return obj
    })

    return e.json(200, {
      page,
      perPage,
      items,
      hasMore,
    })
  },
  $apis.requireAuth(),
)
