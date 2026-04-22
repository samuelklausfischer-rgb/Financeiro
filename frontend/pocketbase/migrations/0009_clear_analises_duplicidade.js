migrate(
  (app) => {
    // Clears all existing records from the duplicity analysis history to provide a fresh start
    app.db().newQuery('DELETE FROM analises_duplicidade').execute()
  },
  (app) => {
    // Irreversible data deletion, no down migration possible
  },
)
