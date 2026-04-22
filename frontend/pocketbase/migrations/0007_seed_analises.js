migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('analises_duplicidade')

    let adminId = null
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'samuelklausfischer@hotmail.com')
      adminId = admin.id
    } catch (_) {}

    try {
      app.findFirstRecordByData('analises_duplicidade', 'file_name', 'pagamentos_marzo_2026.xlsx')
      return
    } catch (_) {}

    const record = new Record(collection)
    record.set('file_name', 'pagamentos_marzo_2026.xlsx')
    record.set('status', 'completed')
    if (adminId) {
      record.set('uploaded_by', adminId)
    }
    record.set('total_records', 250)
    record.set('analyzable_records', 248)
    record.set('duplicate_count', 2)
    record.set('manual_review_count', 2)
    record.set('name_repeat_manual_count', 0)
    record.set('group_count', 2)
    record.set('manual_group_count', 1)
    record.set('name_repeat_manual_group_count', 0)
    record.set('overall_manual_count', 2)
    record.set('overall_manual_group_count', 1)
    record.set('partial_structure_count', 2)

    record.set('result_json', {
      duplicateGroups: [
        {
          groupId: 'dup-1',
          records: [
            {
              linha_origem: 45,
              unidade: 'SP',
              nome_original: 'Fornecedor Tech',
              departamento_original: 'TI',
              valor_normalizado: 4500.0,
              vencimento: '2026-03-10',
              parcela: '1/1',
              cpf_cnpj: '12.345.678/0001-99',
            },
            {
              linha_origem: 89,
              unidade: 'SP',
              nome_original: 'Fornecedor Tech',
              departamento_original: 'TI',
              valor_normalizado: 4500.0,
              vencimento: '2026-03-10',
              parcela: '1/1',
              cpf_cnpj: '12.345.678/0001-99',
            },
          ],
        },
      ],
      manualReviewGroups: [
        {
          groupId: 'man-1',
          records: [
            {
              linha_origem: 200,
              unidade: 'MG',
              nome_original: 'Consultoria RH',
              departamento_original: 'RH',
              valor_normalizado: 8000.0,
              vencimento: '2026-03-20',
              parcela: '1/1',
              cpf_cnpj: '55.555.555/0001-55',
            },
            {
              linha_origem: 205,
              unidade: 'MG',
              nome_original: 'Consultoria RH',
              departamento_original: 'RH',
              valor_normalizado: 8000.0,
              vencimento: '2026-03-25',
              parcela: '1/1',
              cpf_cnpj: '55.555.555/0001-55',
            },
          ],
        },
      ],
      nameRepeatManualGroups: [],
      partialStructureRecords: [
        {
          linha_origem: 10,
          unidade: 'SP',
          nome_original: 'Empresa Sem CNPJ',
          departamento_original: 'Marketing',
          valor_normalizado: 500.0,
          vencimento: '2026-03-05',
          parcela: '',
          cpf_cnpj: '',
        },
        {
          linha_origem: 22,
          unidade: 'SP',
          nome_original: 'Autônomo João',
          departamento_original: 'Comercial',
          valor_normalizado: 150.0,
          vencimento: '2026-03-08',
          parcela: '',
          cpf_cnpj: '',
        },
      ],
    })

    app.save(record)
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData(
        'analises_duplicidade',
        'file_name',
        'pagamentos_marzo_2026.xlsx',
      )
      app.delete(record)
    } catch (_) {}
  },
)
