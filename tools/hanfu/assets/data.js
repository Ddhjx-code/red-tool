(function () {
  window.HFData = {
    HAIR: [
      { id: "h0", name: "垂髻", know: "垂髻是古代女子常见的发式，长发挽髻垂于脑后，温婉端庄，是日常最朴素的梳法。" },
      { id: "h1", name: "双丫髻", know: "双丫髻将头发在头顶两侧各挽一髻，形似双丫，多见于少女，显得灵动俏皮。" },
      { id: "h2", name: "高髻", know: "高髻将头发高挽于顶，挺拔端庄，是古代女子正式场合常见的发式，尽显雍容。" }
    ],
    TOP: [
      { id: "t0", name: "交领襦", know: "交领襦是汉服最基础的上衣，交领右衽——衣领相交、左襟压右襟，是汉服最经典的形制。" },
      { id: "t1", name: "直领袄", know: "直领袄为直领对襟的上袄，多用于秋冬，外穿保暖，是汉服常见的上衣形制。" },
      { id: "t2", name: "圆领袍", know: "圆领袍领口圆润，源自隋唐，男女皆可穿，是汉服中利落大方的一种袍服。" }
    ],
    SKIRT: [
      { id: "s0", name: "齐胸襦裙", know: "齐胸襦裙裙腰束于胸上，裙摆垂坠飘逸，盛行于隋唐，显得身形修长、仙气十足。" },
      { id: "s1", name: "齐腰襦裙", know: "齐腰襦裙裙腰束于腰间，是襦裙最基础的形制，上襦下裙，日常百搭。" },
      { id: "s2", name: "马面裙", know: "马面裙前后有平整裙门、两侧打褶，是明清流行的裙式，如今也是汉服里最热门的下裙。" }
    ],
    BG: [
      { id: "bg_yuanlin", name: "园林" },
      { id: "bg_taohua", name: "桃花林" },
      { id: "bg_yueye", name: "月夜" }
    ],
    SHOE: [
      { id: "shoe_xiuhua", name: "绣花鞋", know: "绣花鞋以针线在鞋面绣出花鸟纹样，是汉服最常见的足衣，步步生花，寓意吉祥。" },
      { id: "shoe_gong", name: "弓鞋", know: "弓鞋鞋头微弯、形似弯弓，小巧精致，是古代女子常见的鞋式。" },
      { id: "shoe_qiaotou", name: "翘头履", know: "翘头履鞋头上翘如凤首，多配礼服穿着，端庄华贵，有步步高升之意。" }
    ],
    comboImg: function (h, t, s, sh) {
      return "./assets/img/" + h + "_" + t + "_" + s + "_" + sh + ".webp";
    },
    bgImg: function (id) {
      return "./assets/img/" + id + ".webp";
    },
    find: function (cat, id) {
      var list = cat === "hair" ? this.HAIR : cat === "top" ? this.TOP : cat === "skirt" ? this.SKIRT : this.SHOE;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
  };
})();
