import { createBrowserRouter } from "react-router";
import { Dashboard } from "./screens/Dashboard";
import { Portfolio } from "./screens/Portfolio";
import { AssetDetail } from "./screens/AssetDetail";
import { AddTransaction } from "./screens/AddTransaction";
import { Settings } from "./screens/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/portfolio",
    Component: Portfolio,
  },
  {
    path: "/asset/:id",
    Component: AssetDetail,
  },
  {
    path: "/add-transaction",
    Component: AddTransaction,
  },
  {
    path: "/settings",
    Component: Settings,
  },
]);
