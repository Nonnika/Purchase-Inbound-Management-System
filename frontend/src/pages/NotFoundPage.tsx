import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button/Button'

export function NotFoundPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-label">404</div>
        <h1 style={{ fontSize: '48px', fontWeight: 300, lineHeight: 1.17, marginBottom: '16px' }}>
          页面未找到
        </h1>
        <p style={{ color: 'var(--cds-text-secondary)', marginBottom: '32px', maxWidth: '640px' }}>
          你访问的页面不存在或尚未实现。
        </p>
        <Link to="/">
          <Button variant="primary">返回首页</Button>
        </Link>
      </div>
    </section>
  )
}
