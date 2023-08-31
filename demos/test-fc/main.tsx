import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const Child = ({ children }) => {
	const now = performance.now();
	while (performance.now() - now < 4) {
		// busy
	}
	return <h3>{children}</h3>;
};

export function App() {
	const [num, update] = useState(100);
	return (
		<ul onClick={() => update(50)}>
			{new Array(num).fill(0).map((_, i) => (
				<Child key={i}>{i}</Child>
			))}
		</ul>
	);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
