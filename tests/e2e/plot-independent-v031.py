"""Plot completed external observation; never interacts with the application."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path('target/acceptance-v0.3.1')
result=json.loads((root/'independent-result.json').read_text(encoding='utf-8'))
assert result['seconds']>=5400
rows=[json.loads(line) for line in (root/'independent-processes.jsonl').read_text(encoding='utf-8').splitlines()]
t=np.array([r['elapsedSeconds']/60 for r in rows])
fig,axes=plt.subplots(3,1,figsize=(10,8),sharex=True,layout='constrained')
axes[0].plot(t,[r['rssBytesSum']/1048576 for r in rows],label='Sum of working sets',color='#315a43')
axes[0].plot(t,[r['privateBytesSum']/1048576 for r in rows],label='Private committed',color='#8059a6')
axes[0].set_ylabel('Full app group (MiB)');axes[0].legend(loc='lower right')
for name,color in [('msedgewebview2.exe','#bc733a'),('asr-worker.exe','#507ba5'),('llama-server.exe','#315a43')]:
    axes[1].plot(t,[sum(p['rssBytes'] for p in r['processes'] if p['name']==name)/1048576 for r in rows],label=name,color=color)
axes[1].set_ylabel('Working sets by name (MiB)');axes[1].legend(loc='lower right')
axes[2].plot(t,[r['cpuPercentNormalized'] for r in rows],color='#73797d',alpha=.5,linewidth=.7,label='2-second samples')
axes[2].set_ylabel('CPU (% of 32 logical CPUs)');axes[2].set_xlabel('Actual elapsed minutes');axes[2].set_xlim(0,90)
for ax in axes:
    ax.grid(alpha=.2)
    for a,b in [(5,15),(40,50),(80,90)]:ax.axvspan(a,b,color='#315a43',alpha=.05)
fig.suptitle('LectureRelay 0.3.1 — installed local speech + translation\nExternal observation; no WebDriver, forced GC or worker restart',fontsize=13)
out=root/'independent-resources.png';fig.savefig(out,dpi=160);plt.close(fig)
print(out)
