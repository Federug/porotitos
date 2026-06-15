const fs = require('fs')
const path = require('path')
 
const envPath = path.join(__dirname, '..', '.env.production')
const buildTime = new Date().toISOString()
 
// Read existing file or start fresh
let lines = []
if (fs.existsSync(envPath)) {
  lines = fs.readFileSync(envPath, 'utf8').split('\n').filter(l => l && !l.startsWith('REACT_APP_BUILD_TIME='))
}
lines.push(`REACT_APP_BUILD_TIME=${buildTime}`)
fs.writeFileSync(envPath, lines.join('\n') + '\n')
console.log(`✓ Build time: ${buildTime}`)
 
