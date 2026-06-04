const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.production')
const buildTime = new Date().toISOString()

let content = ''
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf8')
  content = content.split('\n').filter(l => !l.startsWith('REACT_APP_BUILD_TIME=')).join('\n')
}

content += '\nREACT_APP_BUILD_TIME=' + buildTime + '\n'
fs.writeFileSync(envPath, content)
console.log('Build time set: ' + buildTime)
