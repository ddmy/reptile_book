const prompts = require('@inquirer/prompts')
const select = require('@inquirer/select')
const webMap = require('./webMap.js')
const startFetchUrl = require('./app.js')


async function start () {
  const choices = webMap.map(item => {
    return {
      name: item.name,
      value: item.webBase,
      description: `网站分类：${ item.classify.join(',') }`,
    }
  })
  const webBase = await select.default({
    message: '请选择抓取网站',
    choices,
    pageSize: 20,
  }).catch(() => {})

  const currentWeb = webMap.find(item => item.webBase === webBase)
  const classifyChoices = currentWeb.classify.map((item, index) => {
    return {
      name: item,
      value: index,
      description: '',
    }
  })
  const readType = await select.default({
    message: `请选择 ${currentWeb.name} 文章分类`,
    choices: classifyChoices,
    pageSize: 20,
  }).catch(() => {})

  const runConfig = {
    webBase,
    bookTypeIndex: readType + 1,
    fileNameArr: currentWeb.classify,
    webName: currentWeb.name,
    readType: 'content',
  }
  startFetchUrl(runConfig)
}

start()
