import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const Child = () => <h3>yuanbz shazi</h3>;

export function App() {
	const [num, dispatch] = useState(100);
	window.setNum = dispatch;
	return num === 3 ? <p>{num + 1000}</p> : <div>{num}</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
