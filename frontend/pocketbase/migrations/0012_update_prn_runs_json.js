migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('prn_report_runs')
    if (!col.fields.getByName('result_json')) {
      col.fields.add(new JSONField({ name: 'result_json', maxSize: 5242880 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('prn_report_runs')
    col.fields.removeByName('result_json')
    app.save(col)
  },
)
