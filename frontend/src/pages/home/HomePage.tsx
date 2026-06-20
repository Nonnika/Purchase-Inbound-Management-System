import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button/Button'
import { Tag } from '@/components/ui/Tag/Tag'
import styles from './HomePage.module.css'

/**
 * Landing / overview page. Doubles as a living design-system showcase so the
 * Carbon-inspired tokens are visible while the real feature pages are built out.
 */
export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>物品采购入库管理系统</h1>
          <p className={styles.heroSubtitle}>
            统一管理采购申请、订单与入库流程。基于 IBM Carbon 设计语言构建的现代化企业级界面，
            前端采用 Vite + React + TypeScript。
          </p>
          <div className={styles.heroButtons}>
            <Link to="/users">
              <Button variant="primary" iconRight={<span aria-hidden>→</span>}>
                查看用户管理
              </Button>
            </Link>
            <Link to="/users">
              <Button variant="secondary">浏览接口示例</Button>
            </Link>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Feature tiles */}
      <section className="section section--alt">
        <div className="container">
          <div className="section-label">01 / 模块</div>
          <h2 className="section-title">系统功能</h2>
          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <Tag kind="blue">采购管理</Tag>
              <h3 className={styles.cardTitle}>采购申请与订单</h3>
              <p className={styles.cardBody}>发起采购申请，跟踪订单状态，管理供应商与采购明细。</p>
            </article>
            <article className={styles.card}>
              <Tag kind="green">入库管理</Tag>
              <h3 className={styles.cardTitle}>物品入库</h3>
              <p className={styles.cardBody}>到货验收、入库登记，实时更新库存与入库记录。</p>
            </article>
            <article className={styles.card}>
              <Tag kind="gray">基础数据</Tag>
              <h3 className={styles.cardTitle}>用户与权限</h3>
              <p className={styles.cardBody}>管理用户、角色与部门，按角色控制功能访问范围。</p>
            </article>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* Component showcase */}
      <section className="section">
        <div className="container">
          <div className="section-label">02 / 组件预览</div>
          <h2 className="section-title">设计系统组件</h2>
          <div className={styles.buttonRow}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div className={styles.tagRow}>
            <Tag kind="blue">信息</Tag>
            <Tag kind="green">成功</Tag>
            <Tag kind="red">错误</Tag>
            <Tag kind="gray">默认</Tag>
          </div>
        </div>
      </section>
    </>
  )
}
