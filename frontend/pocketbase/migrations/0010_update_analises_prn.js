migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('analises_duplicidade')

    col.fields.add(
      new SelectField({
        name: 'tipo_analise',
        values: ['duplicidade', 'prn'],
        maxSelect: 1,
      }),
    )

    col.fields.add(
      new DateField({
        name: 'data_referencia',
      }),
    )

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('analises_duplicidade')
    col.fields.removeByName('tipo_analise')
    col.fields.removeByName('data_referencia')
    app.save(col)
  },
)
