(function () {
  window.KJData = {
    RANKS: [
      { id: "tongsheng", name: "童生", color: "#9AA0A8", text: "#3a3f45", size: 21,
        fact: "过了县试、府试，还没过院试的读书人，不论年纪多大，哪怕白发苍苍，都只能叫「童生」。" },
      { id: "xiucai", name: "秀才", color: "#6B8CAE", text: "#ffffff", size: 27,
        fact: "通过院试即为秀才，也叫生员，从此踏入仕途之门，可免徭役、见官不跪。" },
      { id: "juren", name: "举人", color: "#4E7A6E", text: "#ffffff", size: 34,
        fact: "乡试每三年在省城举行一次，叫「秋闱」，考中即为举人，第一名称「解元」，已可做官。" },
      { id: "gongshi", name: "贡士", color: "#8E6BAE", text: "#ffffff", size: 42,
        fact: "乡试次年在京城举行会试，叫「春闱」，考中即为贡士，第一名称「会元」。" },
      { id: "jinshi", name: "进士", color: "#C3272B", text: "#ffffff", size: 51,
        fact: "贡士参加皇帝亲自主持的殿试，录取分三甲：一甲赐「进士及第」，二甲「进士出身」，三甲「同进士出身」。" },
      { id: "tanhua", name: "探花", color: "#E8A33D", text: "#5a3a10", size: 61,
        fact: "殿试一甲第三名。「探花」之名始于唐代：新科进士宴上，选两位最年轻的进士遍游名园、采摘名花。" },
      { id: "bangyan", name: "榜眼", color: "#5A4A8A", text: "#ffffff", size: 72,
        fact: "殿试一甲第二名。金榜上状元居中，榜眼分列其下两侧，如双目之睛，故名「榜眼」。" },
      { id: "zhuangyuan", name: "状元", color: "#E6B422", text: "#5a3a10", size: 84,
        fact: "殿试一甲第一名，科举之巅。居金榜之首称「状头」。乡试、会试、殿试皆第一，即「连中三元」，千年来仅十余人。" }
    ],
    EXAMS: "县试·府试 → 院试(秀才) → 乡试(举人) → 会试(贡士) → 殿试(进士)",
    DROP_MAX_TIER: 4
  };
})();
