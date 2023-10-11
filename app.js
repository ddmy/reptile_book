const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')
const uas = require('./ua')
const writeContentToFile = require('./writeContentToFile.js')


// 开始执行脚本抓取
async function startFetchUrl (config) {
  // 网站主域名， 抓取类型索引（从1开始）, 抓取站点书籍类型, 网站名称, 抓取模式(content抓取正文， index 抓取目录)
  const { webBase, bookTypeIndex, fileNameArr, webName,  readType = 'content' } = config
  let prevRequestUrl = ''
  // 书籍列表起始页
  let classIfyPage = ''
  // 书籍列表页所有页面
  const classIfyPageList = []
  // 所有页面的书籍列表
  const allPageBooks = {}
  // 当前页面所有书籍列表
  let currentPageBooks = {}
  // 每批次处理的请求数量
  const batchSize = 100
  // 书籍写入目录
  const writeFileName = `./${webName}_网站/${fileNameArr[bookTypeIndex - 1]}/`
  // 各分类总目录名称
  const bookTypeIndexName = `${fileNameArr[bookTypeIndex - 1]}-目录`
  
  function randomArrayItem (arr) {
    // 生成一个随机索引
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
  }
  
  function sleep(time) {
    return new Promise(resolve => {
      console.log(`等待${time / 1000}秒>>>>>>`)
      setTimeout(resolve, time)
    })
  }
  
  function readDirFileNames (directoryPath) {
    return new Promise((resolve, reject) => {
      // 使用fs.readdir读取目录内容
      fs.readdir(directoryPath, (err, files) => {
        if (err) {
          // 读取文件出错
          resolve([])
          return;
        }
        // 过滤出文件
        const fileNames = files.filter((file) => {
          return fs.statSync(path.join(directoryPath, file)).isFile();
        });
        // 打印文件名
        resolve(fileNames.map(name => name.split('.')[0]))
      });
    })
  }
  // 添加请求拦截器
  axios.interceptors.request.use(function (config) {
    const platform = ['Windows', 'macOS', 'Linux']
    const cookie = ['', `Hm_lvt_b73487bc2c408bef74a8d45b4fa17235=1695290460; Hm_lpvt_b73487bc2c408bef74a8d45b4fa17235=1695352140; Hm_lpvt_2dbbd919c12e0fdcebfe68622c022bbe=1695352140`, `Hm_lvt_2dbbd919c12e0fdcebfe68622c022bbe=1695290460;`,]
    const sUa = [`Google Chrome=;v=117, Not;A=Brand;v=8, Chromium;v=117`, `Not/A)Brand;v=99, Google Chrome;v=115, Chromium;v=115`, `Microsoft Edge;v=117, Not;A=Brand;v=8, Chromium;v=117`]
    const site = [`same-origin`, `cross-site`, `none`]
    // 在发送请求之前做些什么
    config.headers[`User-Agent`] = randomArrayItem(uas)
    config.headers[`Cookie`] = randomArrayItem(cookie)
    config.headers[`Accept`] = `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`
    config.headers[`Host`] = `www.biquka.org`
    config.headers[`Pragma`] = `no-cache`
    config.headers[`Referer`] = prevRequestUrl
    config.headers[`Sec-Ch-Ua`] = randomArrayItem(sUa)
    config.headers[`Sec-Ch-Ua-Platform`] = randomArrayItem(platform)
    config.headers[`Sec-Fetch-User`] = `?1`
    config.headers[`Sec-Fetch-Site`] = randomArrayItem(site)
    config.headers[`Sec-Fetch-Mode`] = `navigate`
    config.headers[`Sec-Fetch-Dest`] = `document`
    config.timeout = 0
    config.proxy = {
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890,
    }
    return config;
  }, function (error) {
    // 对请求错误做些什么
    return Promise.reject(error);
  });
  
  // 添加响应拦截器
  axios.interceptors.response.use(function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    prevRequestUrl = response.url
    return response;
  }, function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    return Promise.reject(error);
  });
  
  let bookData = {
    title: '',
    author: '',
    contentMap: {},
    content: [],
  }
  
  function readPageContent (url, index) {
    return new Promise((resolve, reject) => {
      const path = url + `?${Math.random()}`
      axios.get(path).then(response => {
        const html = response.data
        const $ = cheerio.load(html)
        const result = {
          index,
          title: $('.bookname h1:first').text(),
          content: $('#content').html().replaceAll('<br>', `\n`)
        }
        // console.log(`${bookData.title}: ${result.title} 抓取成功！`)
        resolve(result)
      }).catch(reject)
    })
  }
  
  let currentPageList = []
  // 批量并发请求
  let reloadIndex = 1
  async function senRequests(urlList) {
    currentPageList = []
    for (let i = 0; i < urlList.length; i += batchSize) {
      const batch = urlList.slice(i, i + batchSize); // 获取当前批次的请求
      console.log(`《${bookData.title}》: 开始请求第${i}-${i + batchSize}章>>>>>> `)
      // 使用Promise.all并发处理当前批次的请求
      const result = await Promise.all(batch.map(url => readPageContent(url, i))).catch(err => {})
      if (!result || !Array.isArray(result) || result.length !== batch.length) {
        console.log(`抓取失败, 第${reloadIndex} 次重试>>>>>>>>>>`)
        reloadIndex++
        i -= batchSize
        // 请求失败的时候多等待20秒
        await sleep(20000)
      } else {
        result.forEach(item => {
          currentPageList.push(item.title + '\n' + item.content)
        })
        reloadIndex = 1
        console.log(`抓取成功！`)
      }
      await sleep(Math.floor(5 + Math.random() * 15) * 1000)
    }
  }
  
  async function startRead()  {
    return new Promise(async (resolve, reject) => {
      const urlList = Object.values(bookData.contentMap)
      await senRequests(urlList)
      writeContentToFile(path.resolve(__dirname, `${writeFileName}${bookData.title}.txt`), currentPageList.join('\n\n')).then(() => {
        console.log(`《${bookData.title}》>>>>>>>>已成功写入到文件！`)
        resolve()
      }).catch(err => {
        console.error('写入文件时发生错误：', err);
        reject(err)
      })
    })
  }
  
  // 开始抓取指定目录的书
  async function startBook(bookHome) {
    const response = await axios.get(bookHome + `?${Math.random()}`).catch()
    if (!response || response.status !== 200) {
      console.log('获取书籍目录失败！')
      await sleep(10000)
      await startBook(bookHome)
      return false
    }
    const html = response.data
    const $ = cheerio.load(html)
    bookData.title = $('#info h1:first').text()
    $('dd a').each((_, v) => {
      const current = $(v)
      bookData.contentMap[current.text()] = webBase + current.attr('href')
    })
    console.log(`开始抓取>>>>>>>《${bookData.title}》，总计${Object.keys(bookData.contentMap).length}章节`)
    await startRead().catch(() => {
      console.log(`${bookData.title} 抓取失败！`)
    })
  }
  
  // 开始读取当前页面的书籍内容
  async function fetchCurrentPageBookContent () {
    const bookKeys = Object.keys(currentPageBooks)
    for (const book of bookKeys) {
      bookData = {
        title: '',
        author: '',
        contentMap: {},
        content: [],
      }
      // 获取当前已经写入的书名
      const bookNames = await readDirFileNames(path.resolve(__dirname, writeFileName)).catch()
      if (bookNames && bookNames.includes(book)) {
        console.log(`${book} 已经下载，跳过!`)
      } else {
        // 书籍目录页面
        const bookHome = webBase + currentPageBooks[book]
        await startBook(bookHome).catch(err => {
          console.log(`${book}抓取失败！[1]`)
        })
      }
    }
  }
  
  // 获取当前页面的所有书籍列表
  async function getCurrentPageBooks() {
    let index = 1
    for (const page of classIfyPageList) {
      currentPageBooks = {}
      const response = await axios.get(webBase + page + `?${Math.random()}`).catch()
      if (!response || response.status !== 200) return console.log(`获取第${index + 1}页页面失败`)
      const html = response.data
      const $ = cheerio.load(html)
      $('.novellist ul li a').each((_, v) => {
        // 当前页的书籍
        currentPageBooks[$(v).text()] = $(v).attr('href')
        // 所有页面的书籍
        allPageBooks[$(v).text()] = $(v).attr('href')
      })
      console.log(`第${index}页书籍信息收录完毕，开始抓取第${index}页书籍信息>>>>>>>>>>>`)
      index++
      if (readType === 'content') {
        // content 抓取正文， index 抓取目录
        await fetchCurrentPageBookContent().catch(err => {
          console.log(err)
        })
      }
    }
  }
  
  // 获取当前抓取的类型的起始页
  async function getCurrentStartPageUrl () {
    console.log('初始化网站>>>>>>')
    const response = await axios.get(webBase).catch(() => {})
    if (!response || response.status !== 200) return console.log('加载网站首页失败！', webBase)
    const html = response.data
    const $ = cheerio.load(html)
    const startPage = $('.footer a:contains("网站导航")').attr('href')
    if (!startPage) return console.log('获取地图起始数据失败！')
    const mapRes = await axios.get(startPage).catch(() => {})
    if (!mapRes || mapRes.status !== 200) return console.log('获取地图起始数据失败！', startPage)
    const $Map = cheerio.load(mapRes.data)
    // $Map('#wrapper .layui-table a').each((index, value) => {
    //   console.log(index, $Map(value).text(), $Map(value).attr('href'))
    // })
    classIfyPage = $Map($Map('#wrapper .layui-table a')[bookTypeIndex - 1]).attr('href')
    console.log('当前任务起始页面>>>>>>>', classIfyPage)
  }

  // 获取当前分页，获取到所有页面地址
  async function getAllClassIfyPage () {
    console.log('脚本启动： 开始抓取>>>>>>>>>')
    await getCurrentStartPageUrl()
    if (!classIfyPage) {
      console.log('重试>>>>>>')
      await sleep(10000)
      await getAllClassIfyPage()
      return
    }
    const url = webBase + classIfyPage + `?${Math.random()}`
    axios.get(url).then(async response => {
      if (response.status !== 200) return console.log('获取书籍列表页信息失败！', url)
      const html = response.data
      const $ = cheerio.load(html)
      $('#update_page a').each((_, v) => {
        classIfyPageList.push($(v).attr('href'))
      })
      // console.log('classIfyPageList', classIfyPageList)
      await getCurrentPageBooks()
      // 记录所有书籍的目录
      writeContentToFile(path.resolve(__dirname, `./${webName}/${bookTypeIndexName}.txt`), JSON.stringify(allPageBooks)).then(() => {
        console.log(`目录>>>>>>>已成功写入到文件！`);
      }).catch()
    }).catch(async err => {
      console.log('获取书籍列表页信息失败！重新尝试>>>>>>>', url)
      await sleep(20000)
      getAllClassIfyPage()
    })
  }
  await getAllClassIfyPage()
  // startBook(webBase + '/Html/Book/166/166514/').catch(err => {console.log('读取失败！111')})
}

module.exports = startFetchUrl
