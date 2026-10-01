// Turns WebM recordings into MP4 (H.264 video, AAC sound) so they upload anywhere.
// Chrome and Edge record MP4 directly; Firefox only records WebM, so its videos come through here.
// The converter (Mediabunny, in lib/) only loads the first time it is needed.
(function () {
  const SQ = window.SQ;
  const LIBS = ['lib/mediabunny.min.js', 'lib/mediabunny-aac-encoder.min.js'];
  let loading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // the single-file build carries the libraries inside the page
      const inline = document.querySelector(`script[type="text/plain"][data-lib="${src}"]`);
      const s = document.createElement('script');
      s.src = inline ? URL.createObjectURL(new Blob([inline.textContent], { type: 'text/javascript' })) : src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`could not load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function load() {
    if (!loading) {
      loading = (async () => {
        for (const src of LIBS) await loadScript(src);
        const M = window.Mediabunny;
        // browsers without a built-in AAC encoder (Firefox) get the bundled one
        if (!(await M.canEncodeAudio('aac'))) window.MediabunnyAacEncoder.registerAacEncoder();
        return M;
      })();
      loading.catch(() => (loading = null));
    }
    return loading;
  }

  SQ.mp4 = {
    videoCodec: 'avc', // H.264, what every platform accepts (only changed for testing)
    needed: (blob) => !!blob && !/mp4/.test(blob.type),
    // Resolves with an MP4 blob; onProgress gets 0..1.
    async convert(blob, onProgress) {
      const M = await load();
      const vc = SQ.mp4.videoCodec;
      if (!(await M.canEncodeVideo(vc))) throw new Error('this browser cannot make H.264 video');
      const input = new M.Input({ source: new M.BlobSource(blob), formats: M.ALL_FORMATS });
      const output = new M.Output({ format: new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
      const conv = await M.Conversion.init({
        input,
        output,
        video: { codec: vc, quality: M.QUALITY_HIGH, forceTranscode: true },
        audio: { codec: 'aac', bitrate: 192000, forceTranscode: true },
      });
      if (!conv.isValid) throw new Error('the recording could not be converted');
      if (onProgress) conv.onProgress = (p) => onProgress(p);
      await conv.execute();
      return new Blob([output.target.buffer], { type: 'video/mp4' });
    },
  };
})();
