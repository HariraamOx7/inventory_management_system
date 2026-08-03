// frontend/src/pages/Home.jsx
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
      <div className="text-center text-white p-8">
        <h1 className="text-5xl font-bold mb-6">
          Inventory Management System
        </h1>
        <p className="text-xl mb-8">
          Manage your store's inventory efficiently and effortlessly.
        </p>
        <Link to="/login">
          <button className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100">
            Login
          </button>
        </Link>
      </div>
    </div>
  );
};

export default Home;