#include <windows.h>
#include <fcntl.h>
#include <io.h>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include "nemo_speech/asr.h"
template<class T>T sym(HMODULE h,const char*n){return reinterpret_cast<T>(GetProcAddress(h,n));}
std::string utf8(const wchar_t*s){int n=WideCharToMultiByte(CP_UTF8,0,s,-1,nullptr,0,nullptr,nullptr);std::string r(n,'\0');WideCharToMultiByte(CP_UTF8,0,s,-1,r.data(),n,nullptr,nullptr);r.pop_back();return r;}
std::string quote(const char*s){std::string r="\"";for(auto*p=reinterpret_cast<const unsigned char*>(s?s:"");*p;p++){if(*p=='"'||*p=='\\'){r+='\\';r+=*p;}else if(*p=='\n')r+="\\n";else if(*p=='\r')r+="\\r";else if(*p=='\t')r+="\\t";else if(*p>=32)r+=*p;}return r+"\"";}
bool reply(int32_t code,const std::string&s){uint32_t n=s.size();if(n>20000){code=-2;n=0;}return fwrite(&code,4,1,stdout)==1&&fwrite(&n,4,1,stdout)==1&&(!n||fwrite(s.data(),1,n,stdout)==n)&&fflush(stdout)==0;}
int wmain(int argc,wchar_t**argv){
 if(argc!=3)return 1;_setmode(_fileno(stdin),_O_BINARY);_setmode(_fileno(stdout),_O_BINARY);
 // The parent applies the global CPU policy and can update it while this stream runs.
 SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32|LOAD_LIBRARY_SEARCH_USER_DIRS);AddDllDirectory(argv[1]);
 HMODULE lib=LoadLibraryExW((std::wstring(argv[1])+L"\\nemo_speech_asr_c.dll").c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
 if(!lib){reply(-1,"");return 2;}
 auto create=sym<decltype(&nemo_speech_asr_create)>(lib,"nemo_speech_asr_create");auto destroy=sym<decltype(&nemo_speech_asr_destroy)>(lib,"nemo_speech_asr_destroy");
 auto defaults=sym<decltype(&nemo_speech_asr_recognition_options_default)>(lib,"nemo_speech_asr_recognition_options_default");
 auto batch=sym<decltype(&nemo_speech_asr_recognize_f32)>(lib,"nemo_speech_asr_recognize_f32");
 auto begin=sym<decltype(&nemo_speech_asr_streaming_recognize)>(lib,"nemo_speech_asr_streaming_recognize");auto push=sym<decltype(&nemo_speech_asr_stream_push_f32)>(lib,"nemo_speech_asr_stream_push_f32");auto next=sym<decltype(&nemo_speech_asr_stream_next)>(lib,"nemo_speech_asr_stream_next");
 auto finish=sym<decltype(&nemo_speech_asr_stream_finish)>(lib,"nemo_speech_asr_stream_finish");auto endpoint=sym<decltype(&nemo_speech_asr_stream_force_endpoint)>(lib,"nemo_speech_asr_stream_force_endpoint");auto close=sym<decltype(&nemo_speech_asr_stream_close)>(lib,"nemo_speech_asr_stream_close");
 auto text=sym<decltype(&nemo_speech_asr_result_transcript)>(lib,"nemo_speech_asr_result_transcript");auto free_result=sym<decltype(&nemo_speech_asr_result_destroy)>(lib,"nemo_speech_asr_result_destroy");auto final_result=sym<decltype(&nemo_speech_asr_result_is_final)>(lib,"nemo_speech_asr_result_is_final");
 if(!create||!destroy||!defaults||!batch||!begin||!push||!next||!finish||!endpoint||!close||!text||!free_result||!final_result){reply(-1,"");return 3;}
 auto model_path=utf8(argv[2]);nemo_speech_asr_backend_config backend={sizeof(backend),-1};nemo_speech_asr_model_config model={sizeof(model),model_path.c_str(),nullptr};
 nemo_speech_asr_batching_config batching={};batching.size=sizeof(batching);batching.enable=false;
 nemo_speech_asr_streaming_config streaming={};streaming.size=sizeof(streaming);streaming.chunk_size=.16f;streaming.rnnt_right_context=1;
 nemo_speech_asr_recognizer_config cfg={};cfg.size=sizeof(cfg);cfg.backend=&backend;cfg.model=&model;cfg.batching=&batching;cfg.streaming=&streaming;
 nemo_speech_asr_recognizer*recognizer=nullptr;int code=create(&cfg,&recognizer);if(!reply(code,"")||code)return 4;
 auto options=defaults();options.language_code="en-US";options.interim_results=true;options.enable_word_time_offsets=true;options.enable_automatic_punctuation=true;
 std::vector<std::string>phrases;std::vector<const char*>phrase_pointers;
 nemo_speech_asr_speech_context context={};context.size=sizeof(context);context.boost=3;
 nemo_speech_asr_stream*stream=nullptr;uint32_t received=0;std::string hypothesis;uint32_t header;
 while(fread(&header,4,1,stdin)==1){
  if(header==0)break;auto command=header>>30;auto count=header&0x3fffffff;if(count>960000){reply(-2,"");break;}
  if(command==3){
   if(count>16384||stream){reply(-2,"");break;}
   std::string payload(count,'\0');if(count&&fread(payload.data(),1,count,stdin)!=count)break;
   phrases.clear();phrase_pointers.clear();size_t offset=0;
   while(offset<payload.size()&&phrases.size()<64){auto end=payload.find('\0',offset);if(end==std::string::npos||end-offset>512){reply(-2,"");return 5;}if(end>offset)phrases.push_back(payload.substr(offset,end-offset));offset=end+1;}
   for(auto&phrase:phrases)phrase_pointers.push_back(phrase.c_str());
   context.phrases=phrase_pointers.data();context.phrase_count=phrase_pointers.size();options.speech_contexts=&context;options.speech_context_count=phrases.empty()?0:1;
   if(!reply(0,""))break;continue;
  }
  std::vector<float>pcm(count);if(count&&fread(pcm.data(),4,count,stdin)!=count)break;
  if(command==0){nemo_speech_asr_result*r=nullptr;code=batch(recognizer,&options,pcm.data(),count,16000,&r);std::string value=r?text(r,0):"";if(r)free_result(r);if(!reply(code,value))break;continue;}
  if(!stream&&command==1){code=begin(recognizer,&options,&stream);received=0;hypothesis.clear();}
  if(code!=0){reply(code,"");break;}
  bool quiet=true;for(uint32_t i=count>8000?count-8000:0;i<count;i++)if(pcm[i]>.004f||pcm[i]<-.004f){quiet=false;break;}
  bool is_final=false;
  if(stream&&count){
   // Drive cache-aware decoding in the engine's documented 160 ms ingress blocks.
   for(uint32_t offset=0;offset<count&&code==0;offset+=2560){auto n=(count-offset)<2560?(count-offset):2560;code=push(stream,pcm.data()+offset,n,16000);received+=n;
    nemo_speech_asr_result*r=nullptr;while(code==0){code=next(stream,&r);if(!r)break;hypothesis=text(r,0);is_final=final_result(r);free_result(r);r=nullptr;}
   }
  }
  bool finalize=command==2||quiet||received>=320000;
  if(stream&&finalize&&code==0){code=finish(stream);nemo_speech_asr_result*r=nullptr;while(code==0){code=next(stream,&r);if(!r)break;hypothesis=text(r,0);is_final=final_result(r);free_result(r);r=nullptr;}is_final=true;}
  std::string value="{\"text\":"+quote(hypothesis.c_str())+",\"final\":"+((finalize||is_final)?"true":"false")+"}";
  if(!reply(code,value))break;
  if(finalize||is_final||code!=0){if(stream)close(stream);stream=nullptr;received=0;hypothesis.clear();}
 }
 if(stream)close(stream);destroy(recognizer);FreeLibrary(lib);return 0;
}
