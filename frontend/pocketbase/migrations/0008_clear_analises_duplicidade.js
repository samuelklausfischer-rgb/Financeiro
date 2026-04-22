migrate(
  (app) => {
    app.db().newQuery('DELETE FROM analises_duplicidade').execute()
  },
  (app) => {
    // Irreversible action
  },
)
