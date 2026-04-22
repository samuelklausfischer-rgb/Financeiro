migrate(
  (app) => {
    const collection = new Collection({
      name: 'analises_duplicidade',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'file_name', type: 'text', required: true },
        {
          name: 'arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 52428800,
          mimeTypes: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
          ],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['processing', 'completed', 'error'],
        },
        {
          name: 'uploaded_by',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'n8n_execution_id', type: 'text', required: false },
        { name: 'error_code', type: 'text', required: false },
        { name: 'error_message', type: 'text', required: false },
        { name: 'total_records', type: 'number', required: false },
        { name: 'analyzable_records', type: 'number', required: false },
        { name: 'duplicate_count', type: 'number', required: false },
        { name: 'manual_review_count', type: 'number', required: false },
        { name: 'name_repeat_manual_count', type: 'number', required: false },
        { name: 'group_count', type: 'number', required: false },
        { name: 'manual_group_count', type: 'number', required: false },
        { name: 'name_repeat_manual_group_count', type: 'number', required: false },
        { name: 'overall_manual_count', type: 'number', required: false },
        { name: 'overall_manual_group_count', type: 'number', required: false },
        { name: 'partial_structure_count', type: 'number', required: false },
        { name: 'result_json', type: 'json', required: false, maxSize: 5242880 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_analises_status ON analises_duplicidade (status)',
        'CREATE INDEX idx_analises_uploaded_by ON analises_duplicidade (uploaded_by)',
        'CREATE INDEX idx_analises_created ON analises_duplicidade (created DESC)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('analises_duplicidade')
    app.delete(collection)
  },
)
