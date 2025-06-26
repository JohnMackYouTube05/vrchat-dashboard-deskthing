import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import  HomePage from './pages/HomePage';
import ViewUser from './pages/ViewUser';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/app/vrchat" element={<HomePage />} />
        <Route path="/app/vrchat/user/:username" element={<ViewUser />} />
        <Route path="/user/:username" element={<ViewUser />} />
      </Routes>
    </Router>
  );
}
