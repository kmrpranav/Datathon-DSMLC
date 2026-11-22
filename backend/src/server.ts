import 'dotenv/config'
import { loadConfig } from './config/env.js'
import { createServices } from './services/container.js'
import { createApp } from './app.js'

const config = loadConfig()
const app = createApp(createServices(config))

app.listen(config.port, () => {
  console.log(`[floodiq-api] listening on http://localhost:${config.port}`)
  console.log(`[floodiq-api] CORS origins: ${config.frontendOrigins.join(', ')}`)
  if (!config.configured) {
    console.warn(`[floodiq-api] Databricks not configured — missing ${config.missing.join(', ')}. Data endpoints will return 503.`)
  } else {
    console.log(`[floodiq-api] Databricks: ${new URL(config.databricks.host).host}, catalog ${config.databricks.catalog}.${config.databricks.schema}`)
  }
})
