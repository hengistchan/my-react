import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const Child = () => <h3>yuanbz shazi</h3>;

export function App() {
	const [num, dispatch] = useState(0);
	return (
		<div>
			<button
				onClick={() => {
					dispatch((num) => num + 1);
					dispatch((num) => num + 1);
					dispatch((num) => num + 1);
				}}
			>
				{num}
			</button>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
