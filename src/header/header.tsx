
import { useState } from 'react'
import './header.css'

const Header = () => {
    const [searchQuery, setSearchQuery] = useState('')

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value)
    }

    return(
        <div className="header">
            <h1>Dashboard</h1>
            <h3>{new Date().toLocaleDateString()}</h3>
            <div className="search-container">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                />
            </div>
        </div>
    )
}

export default Header
