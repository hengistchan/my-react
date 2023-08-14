import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

export function App() {
	const [num, dispatch] = useState(100);
	return (
		<h1>
			<span>{num}</span>
		</h1>
	);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
