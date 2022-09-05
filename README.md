# webrtcPlayer
> webrtc直播播放器, 就是用的srs的代码改的

## 使用方法
### 1. 需要给定一个父容器
例如,
```html
<style>
.rtc-player {
  width: 500px;
  height: 300px;
}
</style>
<div class="rtc-player"></div>
```

### 2. 初始化播放器
```js
const player = new webrtcPlayer({
  dom: document.querySelector('.rtc-player'),
  showControls: false, // 是否显示视频工具栏
  isAutoplay: true // 是否自动播放
})
```

### 3. 播放
```js
player.play(url)
```
