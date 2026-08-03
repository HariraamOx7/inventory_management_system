// frontend/src/routes/AppRoutes.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Home from '../pages/Home.jsx';
import Login from '../pages/Login.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import Department from '../pages/Department.jsx';
import Supplier from '../pages/Supplier.jsx';
import StoreMaster from '../pages/StoreMaster.jsx';
import ProdHeadMaster from '../pages/ProdHeadMaster.jsx';
import SubHead from '../pages/SubHead.jsx';
import Item from '../pages/Item.jsx';
import UOM from '../pages/UOM.jsx';
import PurchaseType from '../pages/PurchaseType.jsx';
import GPPartyMaster from '../pages/PartyMaster.jsx';
import GPItemMaster from '../pages/ItemMaster.jsx';
import State from '../pages/State.jsx';

const AppRoutes = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
        />
        <Route path="/department" element={<Department/>}/>
        <Route path="/supplier" element={<Supplier/>}/>
        <Route path="/storemaster" element={<StoreMaster/>}/>
        <Route path="/prodheadmaster" element={<ProdHeadMaster/>}/>
        <Route path="/subhead" element={<SubHead/>}/>
        <Route path="/item" element={<Item/>}/>
        <Route path="/uom" element={<UOM/>}/>
        <Route path="/purchasetype" element={<PurchaseType/>}/>
        <Route path="/gppartymaster" element={<GPPartyMaster/>}/>
        <Route path="/gpitemmaster" element={<GPItemMaster/>}/>
        <Route path="/state" element={<State/>}/>

      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;