routerAdd(
  'DELETE',
  '/backend/v1/analise-duplicidade/clear',
  (e) => {
    $app.db().newQuery('DELETE FROM analises_duplicidade').execute()
    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
