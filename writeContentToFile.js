const fs = require('fs');
const path = require('path');

function ensureParentDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function writeContentToFile(filePath, content) {
  return new Promise((resolve, reject) => {
    // 确保父目录存在
    ensureParentDirectoryExistence(filePath);
  
    // 然后写入内容
    fs.writeFile(filePath, content, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    });
  })
}

module.exports = writeContentToFile
