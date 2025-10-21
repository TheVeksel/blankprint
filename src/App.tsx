import './main.scss';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UserManager from "./components/UserManager/UserManager";
import PrintForm from "./components/PrintForm/PrintForm";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserManager />} />
        <Route path="/print/:id" element={<PrintForm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
