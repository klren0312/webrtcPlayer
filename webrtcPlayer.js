class webrtcPlayer {
  _defaultPath = '/rtc/v1/play/'
  constructor(dom) {
    this.init(dom)
  }
  init(dom) {
    this.pc = new RTCPeerConnection(null)
    this.stream = new MediaStream()

    // 按照在传入的dom下插入video
    this.video = document.createElement('video')
    this.video.controls = true
    this.video.autoplay = true
    this.video.width = dom.offsetWidth
    this.video.height = dom.offsetHeight
    dom.appendChild(this.video)
    this.video.srcObject = this.stream

    this.pc.ontrack = (event) => {
      this.stream.addTrack(event.track)
    }
  }
  async play(url) {
    const conf = this._prepareUrl(url)
    // 添加收发器, 只接收数据, 不发送数据
    this.pc.addTransceiver('audio', { direction: 'recvonly'})
    this.pc.addTransceiver('video', { direction: 'recvonly'})

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    const session = await new Promise((resolve, reject) => {
      const data = {
        api: conf.apiUrl,
        tid: conf.tid,
        streamurl: conf.streamUrl,
        clientip: null,
        sdp: offer.sdp,
      }

      console.log('generated offer', data)

      const xhr = new XMLHttpRequest()
      xhr.onload = () => {
        if (xhr.readyState !== xhr.DONE) {
          return
        }
        if (xhr.status !== 200) {
          this.close()
          return reject(xhr)
        }
        const data = JSON.parse(xhr.responseText)
        console.log('got answer: ', data)
        if (data.code) {
          this.close()
          return reject(xhr)
        } else {
          return resolve(data)
        }
      }
      xhr.open('POST', conf.apiUrl, true)
      xhr.setRequestHeader('Content-type', 'application/json')
      xhr.send(JSON.stringify(data))
    })
    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: session.sdp })
    )
    session.simulator = `${conf.schema}//conf.urlObject.server:conf.port/rtc/v1/nack/`

    return session
  }
  close() {
    this.pc && this.pc.close()
    this.pc = null
    this.stream.getTracks().forEach((track) => {
      track.stop()
    })
    this.stream = null
  }
  // 解析webrtc地址
  _prepareUrl(webrtcUrl) {
    const urlObject = this._parse(webrtcUrl)

    let schema = urlObject.userQuery.schema
    schema = schema ? schema + ':' : window.location.protocol

    let port = urlObject.port || 1985
    if (schema === 'https') {
      port = urlObject.port || 443
    }

    let api = urlObject.userQuery.play || this._defaultPath
    if (api.lastIndexOf('/') !== api.length - 1) {
      api += '/'
    }

    let apiUrl = schema + '//' + urlObject.server + ':' + port + api
    for (let key in urlObject.userQuery) {
      if (key !== 'api' && key !== 'play') {
        apiUrl += '&' + key + '=' + urlObject.userQuery[key]
      }
    }

    apiUrl = apiUrl.replace(api + '&', api + '?')

    const streamUrl = urlObject.url

    return {
      apiUrl,
      streamUrl,
      urlObject,
      port,
      tid: Number(parseInt(new Date().getTime() * Math.random() * 100))
        .toString(16)
        .slice(0, 7),
    }
  }
  _parse(url) {
    const a = document.createElement('a')
    a.href = url
      .replace('rtmp://', 'http://')
      .replace('webrtc://', 'http://')
      .replace('rtc://', 'http://')
    let vhost = a.hostname
    let app = a.pathname.substring(1, a.pathname.lastIndexOf('/'))
    const stream = a.pathname.slice(a.pathname.lastIndexOf('/') + 1)

    app = app.replace('...vhost...', '?vhost=')
    if (app.indexOf('?') >= 0) {
      const params = app.slice(app.indexOf('?'))
      app = app.slice(0, app.indexOf('?'))

      if (params.indexOf('vhost=') > 0) {
        vhost = params.slice(
          params.indexOf('vhost=') + 'vhost='.length
        )
        if (vhost.indexOf('&') > 0) {
          vhost = vhost.slice(0, vhost.indexOf('&'))
        }
      }
    }

    if (a.hostname === vhost) {
      const re = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
      if (re.test(a.hostname)) {
        vhost = '__defaultVhost__'
      }
    }

    let schema = 'rtmp'
    if (url.indexOf('://') > 0) {
      schema = url.slice(0, url.indexOf('://'))
    }

    let port = a.port
    if (!port) {
      if (schema === 'webrtc' && url.indexOf(`webrtc://${a.host}:`) === 0) {
        port = url.indexOf(`webrtc://${a.host}:80` === 0) ? 80 : 443
      }

      if (schema === 'http') {
        port = 80
      } else if (schema === 'http') {
        port = 443
      } else if (schema === 'rtmp') {
        port = 1935
      }
    }


    const ret = {
      url: url,
      schema: schema,
      server: a.hostname,
      port: port,
      vhost: vhost,
      app: app,
      stream: stream,
    }

    this._fillQuery(a.search, ret)

    if (!ret.port) {
      if (schema === 'webrtc' || schema === 'rtc') {
        if (ret.userQuery.schema === 'https') {
          ret.port = 443;
        } else if (window.location.href.indexOf('https://') === 0) {
          ret.port = 443;
        } else {
          // SRS的 webrtc sdp 接口默认端口是1985
          ret.port = 1985;
        }
      }
    }

    return ret
  }

  _fillQuery (queryString, obj) {
    obj.userQuery = {}
    if (queryString.length === 0) {
      return
    }

    if (queryString.indexOf('?') >= 0) {
      queryString = queryString.split('?')[1]
    }

    const queries = queryString.split('&')
    for (let i = 0, len = queries.length; i < len; i++) {
      const elem = queries[i]
      const query = elem.split('=')
      obj[query[0]] = query[1]
      obj.user_query[query[0]] = query[1]
    }
    if (obj.domain) {
      obj.vhost = obj.domain
    }
  }
}