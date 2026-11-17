/* 第 3 期：手机内存又满了。
   界面按 iPhone 写。安卓的路径名字不同（设置里搜「存储」），
   但逻辑一样：先看排行，再动最大的那个。文案里点明了。 */

var LESSON = {
  id: 'phone-full',
  series: '点了就会',
  title: '手机内存又满了',
  subtitle: '先看排行，再动最大的那个',
  minutes: 4,

  steps: [
    /* ---------- 01 ---------- */
    {
      kind: 'read',
      chapter: '先分清',
      title: '满的是存储，<em>不是内存</em>',
      body:
        '手机提示「存储空间不足」，说的是存储——照片、App、缓存住的地方，128 G、256 G 那个。\n' +
        '内存是另一回事，8 G、12 G，决定你能同时开几个 App。它满了只会卡一下，清一下后台就好，不会提示空间不足。\n' +
        '所以别去下载「内存清理」类 App。它们清的是内存，你要解决的是存储。',
      figure: 'split',
      split: [
        { k: '存储 256 G', t: '照片、App、聊天记录。会满' },
        { k: '内存 8 G', t: '同时开几个 App。满了会卡，不会满' },
        { k: 'iCloud', t: '云端的另一份。和本机空间分开算' }
      ],
      note: {
        k: '安卓怎么看',
        t: '设置里搜「存储」，进去能看到同样的排行。名字可能叫「存储空间」「手机存储」，逻辑和 iPhone 一模一样。'
      }
    },

    /* ---------- 02 ---------- */
    {
      kind: 'sim',
      chapter: '看排行',
      title: '在设置里找到那张排行表',
      body: '入口是 设置 → 通用 → iPhone 存储空间。跟着点。',
      sim: {
        start: 'root',
        states: {
          root: {
            win: '设置',
            prompt: '点「通用」',
            rows: [
              { id: 'wifi', icon: 'gear', label: '无线局域网', sub: '已连接', say: '这是网络。通用再往下一点。' },
              { id: 'bt', icon: 'gear', label: '蓝牙', sub: '打开', say: '蓝牙管耳机和手表，不占存储。' },
              { id: 'face', icon: 'gear', label: '面容 ID 与密码', sub: '', say: '这里是解锁和密码。' },
              { id: 'general', icon: 'gear', label: '通用', sub: '软件更新 · 存储空间', go: 'general', say: '对。存储相关的都在「通用」里。' }
            ]
          },
          general: {
            win: '通用',
            crumb: '设置 › 通用',
            prompt: '点「iPhone 存储空间」',
            rows: [
              { id: 'about', icon: 'gear', label: '关于本机', sub: '', say: '看型号和系统版本的地方。' },
              { id: 'update', icon: 'gear', label: '软件更新', sub: '', say: '升级系统用的。跟清理无关。' },
              { id: 'airdrop', icon: 'gear', label: '隔空投送', sub: '', say: '传文件用的。' },
              { id: 'storage', icon: 'gear', label: 'iPhone 存储空间', sub: '', go: 'storage', say: '进去等几秒，它要先算一遍。' }
            ]
          },
          storage: {
            win: 'iPhone 存储空间',
            crumb: '设置 › 通用 › iPhone 存储空间',
            prompt: '点占得最多的那个 App',
            rows: [
              { id: 'wechat', icon: 'app', label: '微信', sub: '12.4 GB · 上次使用 刚刚', go: 'app', say: '12.4 G，一个 App 吃掉一成。点进去看它怎么用掉的。' },
              { id: 'photos', icon: 'app', label: '照片', sub: '8.1 GB · 3,412 张', say: '照片是大头，但先把微信那 12 G 解决掉。' },
              { id: 'sys', icon: 'app', label: '系统数据', sub: '6.2 GB', say: '这块不建议手动清，等一下会讲。' }
            ]
          },
          app: {
            win: '微信',
            crumb: 'iPhone 存储空间 › 微信',
            prompt: '选「卸载 App」',
            rows: [
              { id: 'offload', icon: 'app', label: '卸载 App', sub: '保留文稿和数据', done: true, say: '对。App 本身走，聊天记录和文稿留在本机。想用时再装回来。' },
              { id: 'delete', icon: 'app', label: '删除 App', sub: '同时删除所有数据', say: '这个会把数据一起删。除非你确定不要了。' },
              { id: 'back', label: '返回', say: '还没解决问题呢。' }
            ]
          }
        }
      }
    },

    /* ---------- 03 ---------- */
    {
      kind: 'read',
      chapter: '看排行',
      title: '排行表上，<em>前三名就是答案</em>',
      body:
        '这张表按占用从大到小排。你不需要清理二十个 App，通常前三个就占了七成。\n' +
        '「系统数据」排进去也别慌，那是系统缓存、日志、临时文件的合计。它会自己涨落，重启一次往往少一截。',
      figure: 'bars',
      bars: [
        { label: '微信', pct: 62, num: '12.4 GB' },
        { label: '照片', pct: 41, num: '8.1 GB' },
        { label: '系统数据', pct: 31, num: '6.2 GB' }
      ],
      caption: '总容量 64 GB，已用 58 GB。前三名加起来 26.7 GB，动它们才有意义。',
      note: {
        k: '别一个一个删照片',
        t: '删 200 张照片大概只能省 600 MB。同样的时间，清一个 App 的缓存能省 5 G。先看排行，别凭感觉。'
      }
    },

    /* ---------- 04 ---------- */
    {
      kind: 'choose',
      chapter: '动手',
      title: '「卸载」和「删除」差在哪',
      body: '这两个按钮挨在一起，后果完全不同。',
      options: [
        { label: '卸载 App：只删程序，保留数据', ok: true, why: '对。App 本体走了，聊天记录、文稿、登录状态都留在本机。空间省得少一些，但不会丢东西。' },
        { label: '删除 App：程序和资料一起删', ok: false, why: '空间回收得最彻底，但数据一起没了。删之前想清楚里面有没有你要留的东西。' },
        { label: '两个一样，只是叫法不同', ok: false, why: '不一样。「卸载」保留数据，是 iPhone 特有的做法；「删除」才是真的清空。' },
        { label: '都不删，等系统自己清', ok: false, why: '系统只会清缓存，不会替你删 App。空间不会自己回来。' }
      ]
    },

    /* ---------- 05 ---------- */
    {
      kind: 'sim',
      chapter: '动手',
      title: '相册里还有个「最近删除」',
      body: '照片删掉后不会立刻消失，会在「最近删除」里放 30 天。这段时间它照样占空间。',
      sim: {
        start: 'trash',
        states: {
          trash: {
            win: '最近删除',
            crumb: '相册 › 最近删除',
            multi: true,
            need: ['burst', 'video'],
            prompt: '勾掉可以彻底删的',
            confirmText: '全部删除，释放 3.0 GB',
            needSay: '两个都勾上了。那个生日视频留着，点下面的删除。',
            doneSay: '删完这 3 G 才真的回来了。注意：这步之后没有第二次机会。',
            rows: [
              { id: 'burst', check: true, label: '连拍 38 张', sub: '1.2 GB · 上周删的', want: true, say: '对。连拍里大半是糊的，删了不亏。' },
              { id: 'video', check: true, label: '微信保存的视频 ×12', sub: '1.8 GB', want: true, say: '这些是群里转的，原视频还在聊天里。' },
              { id: 'shot', check: true, label: '截图 ×3', sub: '6 MB', say: '几十兆解决不了问题，别在这上面花时间。' },
              { id: 'birthday', check: true, label: '生日视频', sub: '1.1 GB', say: '别删。最近删除是最后一次机会，删了相册里就真没了。' }
            ]
          }
        }
      }
    },

    /* ---------- 06 ---------- */
    {
      kind: 'read',
      chapter: '别乱来',
      title: '两件看着有用、<em>其实别做的事</em>',
      body:
        '第一，别去清「系统数据」。网上那些教你删系统缓存的教程，多半是让你进一个隐藏目录，删错一个文件就得重装。\n' +
        '第二，别装「一键清理」「内存加速」这类 App。它们自己有安装包、有广告、有常驻后台，净贡献是负的。\n' +
        '真到了不够用的地步，把照片同步到云端再删本地，比任何清理技巧都管用。',
      note: {
        k: '一个立刻能试的动作',
        t: '重启一次手机。系统会清掉一批临时文件，很多人重启完就多出两三个 G。不花钱，也不用装东西。'
      }
    },

    /* ---------- 07 ---------- */
    {
      kind: 'end',
      chapter: '',
      title: '够用了',
      body: '记住顺序：先看排行，再动前三名，最后清一次最近删除。删东西之前想清楚，别在几十兆的截图上浪费时间。',
      recap: [
        '设置 → 通用 → iPhone 存储空间，等它算完',
        '看前三名，通常就占了七成',
        'App 用「卸载」不用「删除」，数据留着',
        '相册的「最近删除」还占着空间，要单独清',
        '别手动删系统数据，别装清理类 App'
      ]
    }
  ]
};

window.DJL_LESSONS[LESSON.id] = LESSON;
