import { Icon } from '../../components/Icon';
import { useWorkspace } from '../../app/Workspace';

export function PrivacySettings() {
  return (
    <>
      <section className="settings-card">
        <h3>{'数据保存在哪里？何时会上传？'}</h3>
        <div className="privacy-row">
          <Icon name="folder" />
          <div>
            <strong>{'保存在本机'}</strong>
            <p>
              {
                '录音、课程资料和转录文本保存在本机。本地英文识别也在这台电脑上完成。'
              }
            </p>
          </div>
        </div>
        <div className="privacy-row">
          <Icon name="cloud" />
          <div>
            <strong>{'启用云端功能时才会上传'}</strong>
            <p>
              {
                '云端识别会上传录音；设为云端的文本功能会将相关文本和课程背景发送给所选服务商。本地翻译和学习工具在本机处理。云端服务可能收费。'
              }
            </p>
          </div>
        </div>
        <p className="field-hint">
          {
            'API Key 存放在 Windows 凭据管理器中，不会随课堂资料导出。使用 LectureRelay 无需注册账号。'
          }
        </p>
      </section>
    </>
  );
}

export function AboutSettings() {
  const workspace = useWorkspace();
  return (
    <section className="settings-card about-card">
      <h2>LectureRelay</h2>
      <span className="pill">
        {'版本'}
        {workspace.data.storage.version} · Windows
      </span>
      <dl className="storage-list">
        <div>
          <dt>{'界面语言'}</dt>
          <dd>简体中文</dd>
        </div>
        <div>
          <dt>{'支持的译文语言'}</dt>
          <dd>{'中文、日语、韩语'}</dd>
        </div>
        <div>
          <dt>{'项目许可证'}</dt>
          <dd>{'尚未确定'}</dd>
        </div>
        <div>
          <dt>{'开源组件'}</dt>
          <dd>{'第三方许可证与声明随应用一起提供。'}</dd>
        </div>
        <div>
          <dt>{'源码仓库'}</dt>
          <dd>github.com/Eren-Tian/LectureRelay</dd>
        </div>
      </dl>
    </section>
  );
}
