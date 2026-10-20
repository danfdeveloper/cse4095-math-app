import { Outlet } from 'react-router'
import styles from './AppLayout.module.css'
import { StorageWarning } from '../common/StorageWarning'
import { Header } from './Header'
import { PageContainer } from './PageContainer'

/** Shared shell for every route: the header above the routed page. */
export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Header />
      <StorageWarning />
      <PageContainer>
        <Outlet />
      </PageContainer>
    </div>
  )
}
