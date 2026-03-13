
export function enableDemoMode(){
  localStorage.setItem("bondfire_demo","true");
}

export function isDemoMode(){
  return localStorage.getItem("bondfire_demo")==="true";
}

export function resetDemo(){
  localStorage.removeItem("bondfire_demo");
  localStorage.removeItem("bf-demo-user");
}
