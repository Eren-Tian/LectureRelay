"""Developer measurements, never a production dependency."""
import os, psutil, threading, time
class Measure:
 def __init__(self,pid=None):
  self.pid=pid or os.getpid();self.stop=threading.Event();self.rows=[];self.thread=threading.Thread(target=self.sample)
 def sample(self):
  previous={};last=time.perf_counter()
  while not self.stop.wait(.1):
   try:
    parent=psutil.Process(self.pid);processes=[parent]+parent.children(recursive=True);now=time.perf_counter();cpu=0;ram=0
    for p in processes:
     times=p.cpu_times();total=times.user+times.system;cpu+=max(0,total-previous.get(p.pid,total));previous[p.pid]=total;ram+=p.memory_info().rss
    self.rows.append((cpu/(now-last)/(os.cpu_count() or 1)*100,ram/1048576));last=now
   except (psutil.NoSuchProcess,psutil.AccessDenied):pass
 def __enter__(self):self.thread.start();return self
 def __exit__(self,*args):self.stop.set();self.thread.join()
 def values(self):
  return {'cpuAveragePercent':sum(r[0] for r in self.rows)/max(1,len(self.rows)),'cpuPeakPercent':max((r[0] for r in self.rows),default=None),'ramPeakMiB':max((r[1] for r in self.rows),default=None),'scope':'benchmark parent and native worker, normalized across logical CPUs'}
