migrate(
  (app) => {
    const collection = new Collection({
      name: 'prn_report_runs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'data_referencia', type: 'date', required: false },
        { name: 'daily_filename', type: 'text', required: true },
        { name: 'historical_filename', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['processing', 'success', 'error'],
          maxSelect: 1,
        },
        { name: 'webhook_url', type: 'text', required: false },
        { name: 'webhook_http_status', type: 'number', required: false, onlyInt: true },
        { name: 'webhook_content_type', type: 'text', required: false },
        { name: 'duration_ms', type: 'number', required: false, onlyInt: true },
        { name: 'response_html', type: 'text', required: false },
        { name: 'error_code', type: 'text', required: false },
        { name: 'error_message', type: 'text', required: false },
        { name: 'meta', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prn_report_runs_created ON prn_report_runs (created DESC)',
        'CREATE INDEX idx_prn_report_runs_status ON prn_report_runs (status)',
        'CREATE INDEX idx_prn_report_runs_user_id ON prn_report_runs (user_id)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('prn_report_runs')
    app.delete(collection)
  },
)
