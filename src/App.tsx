import './App.css'
import MainDashboard from './main_dashboard/main_dashboard.tsx'
import Header from './header/header.tsx'
import SideBar from './left_sidebar/sideBar.tsx'

function App() {

  return (
    <>
      <Header />
      <SideBar />
      <MainDashboard />
    </>
  )
}

export default App
