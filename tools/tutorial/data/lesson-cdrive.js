/* 教程内容。引擎只认这份结构，换一期只改这个文件。
   sim 是一台「状态机伪窗口」：states 里每个 key 是一屏，row.go 跳下一屏，
   row.say 给错误反馈，state.done 标记完成。 */

var LESSON = {
  id: 'c-drive',
  series: '点了就会',
  title: 'C 盘红了',
  subtitle: '从红条到多出 20 GB，一步一步点',
  minutes: 4,

  steps: [
    /* ---------- 01 ---------- */
    {
      kind: 'read',
      chapter: '先看清',
      title: 'C 盘红了，<em>不是空间不够</em>',
      body:
        '是有人在你不知道的地方囤东西。\n' +
        '系统缓存、更新残留、下载的文件、聊天记录里的图片和视频——它们不会自己消失。\n' +
        '右边这台电脑，C 盘只剩 3.2 GB，D 盘几乎是空的。',
      figure: 'bars',
      note: {
        k: '为什么会卡',
        t: 'C 盘不只是存文件，系统还要在上面写临时数据。剩不到 10% 时，写不进去就只能排队，于是整台机器变慢。'
      }
    },

    /* ---------- 02 ---------- */
    {
      kind: 'sim',
      chapter: '先看清',
      title: '第一步，找到它',
      body: '先确认红的是哪一个盘。点一下 C 盘。',
      sim: {
        start: 'home',
        states: {
          home: {
            win: '此电脑',
            crumb: '此电脑',
            prompt: '点一下 C 盘',
            rows: [
              {
                id: 'c',
                icon: 'drive',
                label: '本地磁盘 (C:)',
                sub: '剩 3.2 GB，共 237 GB',
                say: '就是它。红色条说明快满了。',
                ok: true,
                done: true
              },
              {
                id: 'd',
                icon: 'drive',
                label: '数据 (D:)',
                sub: '剩 512 GB，共 953 GB',
                say: 'D 盘还空着，问题不在它。'
              }
            ]
          }
        }
      }
    },

    /* ---------- 03 ---------- */
    {
      kind: 'read',
      chapter: '先看清',
      title: '里面的东西，分三类',
      body: '不是所有文件都能删。分清楚，才不会删出问题。',
      figure: 'split',
      split: [
        { k: '安全区', t: '临时文件、回收站、更新残留。闭着眼删，出事概率接近零。' },
        { k: '看看区', t: '下载、桌面、文档。删之前打开看一眼，别把要用的删了。' },
        { k: '别动区', t: 'Windows、Program Files。这些是系统和软件本体，动了会坏。' }
      ],
      note: {
        k: '记住这个顺序',
        t: '先删安全区（最快见效），再看看看区（量最大），别动区永远不碰。'
      }
    },

    /* ---------- 04 ---------- */
    {
      kind: 'sim',
      chapter: '最安全的一刀',
      title: '右键 C 盘，看属性',
      body: '电脑上这一步是「右键」。手机上用手指按住不放，一样的。',
      sim: {
        start: 'home',
        states: {
          home: {
            win: '此电脑',
            crumb: '此电脑',
            prompt: '按住 C 盘不放，直到弹出菜单',
            rows: [
              {
                id: 'c',
                icon: 'drive',
                label: '本地磁盘 (C:)',
                sub: '剩 3.2 GB，共 237 GB',
                longpress: 'menu',
                tip: '按住别松手——电脑上这一步叫「右键」'
              }
            ]
          },
          menu: {
            win: '此电脑',
            crumb: '此电脑 › C 盘',
            ctx: true,
            prompt: '选「属性」',
            rows: [
              { id: 'open', label: '打开', say: '打开只是进去看文件，看不到容量。' },
              { id: 'format', label: '格式化', say: '千万别点。这会清空整个盘。' },
              {
                id: 'props',
                label: '属性',
                sub: 'R',
                accent: true,
                go: 'props',
                say: '对，属性里有容量和一个叫「磁盘清理」的按钮。'
              }
            ]
          },
          props: {
            win: '本地磁盘 (C:) 属性',
            crumb: '此电脑 › C 盘 › 属性',
            prompt: '点「磁盘清理」',
            rows: [
              {
                id: 'general',
                label: '已用空间 233 GB',
                sub: '可用 3.2 GB',
                say: '这就是红条的原因。往下有个按钮。'
              },
              {
                id: 'clean',
                icon: 'gear',
                label: '磁盘清理',
                sub: '计算能释放多少空间',
                accent: true,
                say: '这一刀从这里下。',
                done: true
              }
            ]
          }
        }
      }
    },

    /* ---------- 05 ---------- */
    {
      kind: 'sim',
      chapter: '最安全的一刀',
      title: '只勾这两项',
      body:
        '磁盘清理会算出每一项能腾多少。勾错了不会立刻出事，但会丢文件。\n' +
        '这一屏，勾掉能放心删的，然后点确定。',
      sim: {
        start: 'clean',
        states: {
          clean: {
            win: 'C 盘的磁盘清理',
            crumb: '磁盘清理',
            multi: true,
            need: ['tmp', 'bin'],
            prompt: '勾选可以放心删的项',
            confirmText: '确定，释放 4.3 GB',
            doneSay: '清理完成。这一刀通常是全部步骤里最安全、见效最快的一步。',
            needSay: '两项都勾上了。剩下的别碰，点下面的确定。',
            rows: [
              {
                id: 'tmp',
                check: true,
                label: '临时文件',
                sub: '3.1 GB',
                want: true,
                say: '对。程序运行时留下的半成品，删了不影响任何东西。'
              },
              {
                id: 'bin',
                check: true,
                label: '回收站',
                sub: '1.2 GB',
                want: true,
                say: '对。你已经删过一次了，这次是真正倒掉。'
              },
              {
                id: 'dl',
                check: true,
                label: '下载',
                sub: '8.4 GB',
                want: false,
                say: '这里不能勾。下载里是你自己的文件，有 8.4 GB 也不代表能删。'
              },
              {
                id: 'thumb',
                check: true,
                label: '缩略图缓存',
                sub: '240 MB',
                want: false,
                say: '能清，但只有 240 MB，代价是文件夹要重新生成预览。性价比太低。'
              }
            ]
          }
        }
      }
    },

    /* ---------- 06 ---------- */
    {
      kind: 'read',
      chapter: '最安全的一刀',
      title: '还有一个按钮：<em>清理系统文件</em>',
      body:
        '磁盘清理窗口左下角有个「清理系统文件」，点进去会多出几项，最大的是「以前的 Windows 安装」。\n' +
        '那是系统升级时留下的旧版本，通常 5–10 GB。升级完一个月没出问题，就可以删。',
      note: {
        k: '为什么它值得',
        t: '这一项往往比前面全部加起来还大，而且删掉完全不影响使用——只是以后不能一键退回旧版本。'
      }
    },

    /* ---------- 07 ---------- */
    {
      kind: 'sim',
      chapter: '更细的地方',
      title: '设置里还有一层',
      body:
        '磁盘清理看不到全部。设置里有一页专门管这件事，能按类别看到每一块占多少。\n' +
        '路径是：设置 → 系统 → 存储。',
      sim: {
        start: 'settings',
        states: {
          settings: {
            win: '设置',
            crumb: '设置',
            prompt: '点「系统」',
            rows: [
              {
                id: 'sys',
                icon: 'gear',
                label: '系统',
                sub: '显示、声音、通知、电源',
                accent: true,
                go: 'sys',
                say: '第一项。存储就在系统里。'
              },
              { id: 'net', label: '网络和 Internet', sub: 'WLAN、飞行模式', say: '网络不在这里设。' },
              { id: 'acc', label: '账户', sub: '账户、邮箱、同步', say: '这里管的是登录，不是磁盘。' }
            ]
          },
          sys: {
            win: '设置 › 系统',
            crumb: '设置 › 系统',
            prompt: '点「存储」',
            rows: [
              {
                id: 'storage',
                icon: 'gear',
                label: '存储',
                sub: '239 GB 已用',
                accent: true,
                go: 'storage',
                say: '对。这一页会把 C 盘拆成几块给你看。'
              },
              { id: 'disp', label: '显示', sub: '亮度、缩放', say: '显示设置跟空间无关。' },
              { id: 'power', label: '电源和睡眠', sub: '屏幕、睡眠', say: '睡眠确实占点空间，但不是大头。' }
            ]
          },
          storage: {
            win: '设置 › 系统 › 存储',
            crumb: '设置 › 系统 › 存储',
            prompt: '点「临时文件」',
            rows: [
              {
                id: 'tmp',
                label: '临时文件',
                sub: '6.7 GB',
                accent: true,
                say: '这 6.7 GB 就是磁盘清理刚才算过的那些，这里能一起清。',
                done: true
              },
              { id: 'apps', label: '应用和功能', sub: '42.1 GB', say: '这块是装的软件，要清得靠卸载，不是删文件。' },
              { id: 'other', label: '其他', sub: '18.3 GB', say: '系统文件和保留空间，一般不让动。' }
            ]
          }
        }
      }
    },

    /* ---------- 08 ---------- */
    {
      kind: 'read',
      chapter: '更细的地方',
      title: '让它自己清',
      body:
        '同一页往下有个开关叫「存储感知」。打开之后，系统会在空间紧张时自动倒回收站、删临时文件。\n' +
        '设成「每月运行」就够，不用更频繁。',
      note: {
        k: '这一步的意义',
        t: '前面几步是手工抢救，这一颗开关是防止再犯。开了之后，C 盘很少会再红到这种程度。'
      }
    },

    /* ---------- 09 ---------- */
    {
      kind: 'sim',
      chapter: '真正的大头',
      title: '把「下载」搬到 D 盘',
      body:
        '清完上面这些，最多腾出十几 G。真正占地方的是你要留的东西——那就别让它待在 C 盘。\n' +
        '「下载」文件夹可以整个搬家，以后下载自动存到 D 盘。',
      sim: {
        start: 'folder',
        states: {
          folder: {
            win: '下载 属性',
            crumb: '此电脑 › C 盘 › 用户 › 下载',
            prompt: '切到「位置」标签',
            rows: [
              { id: 'general', label: '常规', sub: '大小、只读、隐藏', say: '常规里只有大小，改不了存放位置。' },
              {
                id: 'loc',
                label: '位置',
                sub: 'C:\\Users\\你\\Downloads',
                accent: true,
                go: 'loc',
                say: '对，位置标签才是搬家的入口。'
              }
            ]
          },
          loc: {
            win: '下载 属性 › 位置',
            crumb: '此电脑 › C 盘 › 用户 › 下载 › 位置',
            prompt: '点「移动」',
            rows: [
              { id: 'cur', label: '当前位置', sub: 'C:\\Users\\你\\Downloads', say: '就是这里在吃 C 盘。' },
              {
                id: 'move',
                label: '移动…',
                sub: '选一个新位置',
                accent: true,
                go: 'pick',
                say: '对。选 D 盘之后，系统会把已有文件一起搬过去。'
              }
            ]
          },
          pick: {
            win: '选择一个目标',
            crumb: '此电脑',
            prompt: '选一个空一点的盘',
            rows: [
              {
                id: 'd',
                icon: 'drive',
                label: '数据 (D:)',
                sub: '剩 512 GB',
                accent: true,
                say: '就它。以后下载直接落到 D 盘，C 盘再也不吃这一块。',
                done: true
              },
              {
                id: 'c',
                icon: 'drive',
                label: '本地磁盘 (C:)',
                sub: '剩 3.2 GB',
                say: '还是 C 盘，等于没搬。'
              }
            ]
          }
        }
      }
    },

    /* ---------- 10 ---------- */
    {
      kind: 'choose',
      chapter: '真正的大头',
      title: '这几样，哪个最能删',
      body: '清完系统和下载，还剩一大块。猜一下哪一项通常最占地方。',
      options: [
        {
          label: '微信和 QQ 的聊天文件',
          ok: true,
          why: '对。图片、视频、语音、文件全都堆在文档目录里，几个 G 到几十个 G 都正常。在微信「设置 → 文件管理」里能直接改存放位置。'
        },
        {
          label: 'Windows 系统文件',
          ok: false,
          why: '系统文件确实占十几 G，但那是系统本体。删了会开不了机，只能用清理工具删「旧版本残留」那一部分。'
        },
        {
          label: '桌面上的文件',
          ok: false,
          why: '桌面文件也占 C 盘，但通常只有几百兆。可以整到 D 盘，量不大。'
        },
        {
          label: '浏览器缓存',
          ok: false,
          why: '缓存一般几百兆，清了还会再长回来。属于顺手清，不是大头。'
        }
      ]
    },

    /* ---------- 11 ---------- */
    {
      kind: 'end',
      chapter: '',
      title: '完事了',
      body: '以后每次 C 盘报警，按这个顺序走一遍就行。前三步最安全，后面两步防复发。',
      recap: [
        '右键 C 盘 → 属性 → 磁盘清理，勾临时文件和回收站',
        '磁盘清理左下角「清理系统文件」，删掉旧版 Windows',
        '设置 → 系统 → 存储 → 临时文件，再清一遍',
        '打开存储感知，设成每月自动运行',
        '把「下载」和微信文件目录搬到 D 盘'
      ]
    }
  ]
};

/* 注册到系列清单。必须在本文件内完成，否则下一个 data 文件的 var LESSON 会覆盖它。 */
window.DJL_LESSONS[LESSON.id] = LESSON;
