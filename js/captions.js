// Writes a ready-to-post title, caption and hashtags for a finished match, in the voice of the lore.
// Used by the match info box, the clip farm's caption files and tools/make_videos.py.
(function () {
  const SQ = window.SQ;

  const MODE_TAGS = {
    chase: '#colorchase',
    territory: '#tilewars',
    domain: '#domainduel',
    race: '#squarerace',
    brawl: '#weaponbrawl',
    bounce: '#bouncebrawl',
    marble: '#marblerace',
    hill: '#kingofthehill',
  };

  const sectorOf = (t) => {
    const L = SQ.LORE[t.base];
    return L ? L.sector : '';
  };
  const shortSector = (t) => sectorOf(t).replace(/^(Sector|the) /, '');

  // d: { mode, modeName, cycle, winner, losers, tie, tied, sub, rebooted, fragment, ninthSeen, count }
  SQ.writeCaption = function (d, rand) {
    const R = rand || Math.random;
    const pick = (list) => list[Math.floor(R() * list.length)];
    const c = d.cycle;
    let title;
    const lines = [];
    if (d.tie) {
      const names = d.tied.map((t) => t.name).join(' and ');
      title = pick([`Cycle ${c} has no winner.`, `Nobody leaves Cycle ${c}.`, `${names} went down together.`]);
      lines.push(`${names} took each other out. The Frame does not do ties, so nobody gets the peace this cycle.`);
    } else {
      const W = d.winner;
      const L = d.losers.length ? pick(d.losers) : null;
      const lore = SQ.LORE[W.base];
      const rival = lore && d.losers.find((t) => t.base === lore.rival);
      const options = [`${W.name} survives Cycle ${c}.`, `Cycle ${c} belongs to ${W.name}.`, `${shortSector(W)} eats tonight.`];
      if (L) options.push(`${L.name} did not make it out of Cycle ${c}.`);
      if (d.mode === 'marble') options.push(`${W.name} reached the bottom first. The rest met the lava.`);
      if (d.mode === 'race') options.push(`${W.name} found the way out first.`);
      if (d.mode === 'hill') options.push(`${W.name} held the hill. Nobody else did.`);
      if (d.mode === 'brawl' || d.mode === 'bounce' || d.mode === 'domain') options.push(`Last square standing: ${W.name}.`);
      title = rival && R() < 0.6 ? `${W.name} finally settles it with ${rival.name}.` : pick(options);
      lines.push(`${W.name} of ${sectorOf(W) || 'the Grid'} wins the ${d.modeName}${d.sub ? ` (${d.sub})` : ''}. ${shortSector(W) ? `${shortSector(W)} gets one more cycle of peace.` : ''}`.trim());
      if (rival) lines.push(`${rival.name} ${lore.rivalWhy}. ${W.name} remembers.`);
    }
    if (d.rebooted) {
      title = pick([`Cycle ${c}. The signal broke.`, `Cycle ${c}. Something got through.`, `Cycle ${c}. The Frame went quiet.`]);
      lines.push(`For a few seconds the Frame was not watching. Fragment ${d.fragment} of ${d.fragments}. Keep count.`);
    }
    // viewers who count the squares will find one more than this
    if (d.ninthSeen) lines.push(`${d.count} contestants entered.`);
    const ev = SQ.eventCaption && SQ.eventCaption(d.event, d);
    if (ev) lines.push(ev.line);
    lines.push(pick(['Which Sector are you from?', 'Comment your color.', 'Who do you want in the next cycle?', 'Who saw that coming?', 'Pick a color before the next one.']));
    // a special event greets in the title and names its edition first in the caption
    if (ev) {
      title = `${ev.hi}. ${title}`;
      lines.unshift(`${ev.edition}.`);
    }
    const tags = ['#squares', '#simulation', '#satisfying', '#animation', '#trinitygames', MODE_TAGS[d.mode], ev && ev.tag].filter(Boolean);
    return { title, caption: lines.join('\n'), tags: tags.join(' ') };
  };
})();
