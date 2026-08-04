import React from "react";
import { Outlet } from "react-router-dom";
import ThemeProvider from "../ThemeProvider/ThemeProvider";
import SoftwareUpdateModal from "../SoftwareUpdateModal/SoftwareUpdateModal";
import SessionExpiryGuard from "../Auth/SessionExpiredModal";

export default function Layout() {
  return (
    <ThemeProvider>
      <SessionExpiryGuard />
      <Outlet />
     {/* <SoftwareUpdateModal /> */}
    </ThemeProvider>
  );
}
