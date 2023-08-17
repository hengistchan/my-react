import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const Child = () => <h3>yuanbz shazi</h3>;

export function App() {
	const [num, dispatch] = useState(100);
	return <div onClick={() => dispatch(num + 1)}>{num}</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
