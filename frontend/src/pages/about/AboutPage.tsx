import styles from './AboutPage.module.css'

interface Developer {
  /** 显示名（不含括号昵称）。 */
  name: string
  /** 括号内的昵称/ID。 */
  handle: string
  role: string
  email: string
}

const developers: Developer[] = [
  {
    name: 'Nonnika',
    handle: 'Nonnika.Y',
    role: '后端开发',
    email: 'SunCanHelpU@outlook.com',
  },
  {
    name: 'Syrnaxei',
    handle: 'KanataN',
    role: '前端开发',
    email: 'm1725576689@gmail.com',
  },
]

/**
 * 关于页 —— 项目简介 + 前后端开发者信息。纯静态，无需鉴权接口。
 * 遵循 Carbon 设计：分层背景、0px 圆角（头像除外）、Plex Mono 用于元数据。
 */
export function AboutPage() {
  return (
    <section className="section">
      <div className="container">
        <div className={styles.header}>
          <div>
            <div className="section-label">关于</div>
            <h1 className={styles.title}>采购入库管理系统</h1>
            <p className={styles.intro}>
              一个面向物品采购与入库流程的管理系统，本项目为数据库课程设计作品。
            </p>
          </div>
        </div>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>项目信息</h2>
          <dl className={styles.metaGrid}>
            <dt className={styles.metaKey}>项目名称</dt>
            <dd className={styles.metaVal}>Purchase Inbound Management System (PIMS)</dd>
            <dt className={styles.metaKey}>技术栈</dt>
            <dd className={styles.metaVal}>
              <div className={styles.stack}>
                <span>前端：Vite · React 19 · TypeScript</span>
                <span>后端：Go · Gin · sqlx · MySQL</span>
              </div>
            </dd>
            <dt className={styles.metaKey}>设计规范</dt>
            <dd className={styles.metaVal}>IBM Carbon Design</dd>
            <dt className={styles.metaKey}>项目链接</dt>
            <dt className={styles.metaVal}>https://github.com/Nonnika/Purchase-Inbound-Management-System</dt>
            <dt className={styles.metaKey}>版权</dt>
            <dd className={styles.metaVal}>© 2026 Alpha Studio 版权所有</dd>
          </dl>
        </section>

        <h2 className={styles.panelTitle}>开发团队</h2>
        <div className={styles.devs}>
          {developers.map((dev) => (
            <article key={dev.email} className={styles.devCard}>
              <div className={styles.devHead}>
                <div className={styles.avatar} aria-hidden>
                  {dev.name.slice(0, 1)}
                </div>
                <div>
                  <div className={styles.devName}>
                    {dev.name}
                    <span className={styles.devHandle}> {dev.handle}</span>
                  </div>
                  <div className={styles.devRole}>{dev.role}</div>
                </div>
              </div>
              <a className={styles.devContact} href={`mailto:${dev.email}`}>
                {dev.email}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
