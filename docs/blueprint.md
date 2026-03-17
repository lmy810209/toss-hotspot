# **App Name**: Toss Hotspot

## Core Features:

- Real-time Hotspot Map Display: Visualize various hotspots on an interactive map, displaying congestion levels ('여유(초록)', '보통(노랑)', '붐빔(빨강)') using distinct markers. This feature leverages NextJS's onSnapshot functionality and React state management to ensure that marker colors update instantly without a page refresh when other users submit reports.
- Location-Based Live Reporting: Enable users to report a hotspot's current status ('여유로워요', '줄이 길어요') via a '실시간 제보' button. This button is contextually activated only when the user is within a 100m radius of a hotspot, as determined by the checkProximity function utilizing toss.getLocation(). Reported data instantly updates the Firestore database.
- Dynamic Hotspot Categories: Provide a flexible tab-based navigation structure at the top, allowing users to filter and browse hotspots by different categories such as cherry blossom spots, restaurants, and cafes, supporting scalability for numerous locations.
- Toss SDK Location & Rewards Integration: Integrate the Toss SDK to include a checkProximity function. This function calls window.toss.getLocation() to obtain the user's coordinates and calculate the distance to nearby hotspots, enabling the 100m proximity check for reporting. This also lays the groundwork for future Toss Point rewards API integration upon successful reporting.
- Firestore Real-time Data Backend: Utilize Firebase Firestore for robust real-time storage and retrieval of hotspot data. The 'locations' collection will include fields such as 'category' (e.g., '벚꽃', '카페', '맛집'), 'congestion_level' (1-3 for '여유', '보통', '붐빔'), 'last_updated' (Timestamp), and 'report_count'. This structured approach supports efficient filtering and scalability for tens of thousands of locations and ensures immediate data synchronization across all users.

## Style Guidelines:

- Primary interactive color: Toss Blue (#3182F6). This vibrant blue is used for critical call-to-action buttons, active states, and key navigational elements, aligning with the trusted and modern aesthetic of Toss Design System. (HSL: 215, 92%, 58%).
- Background color: Pure White (#FFFFFF). Serving as a clean, bright canvas that enhances readability and keeps the focus on the map and data, in line with the requested white background. (HSL: 0, 0%, 100%).
- Secondary accent color: A subtle, light cyan-blue (#CCE6E9). This color provides a gentle visual contrast, suitable for secondary highlights or informational components without competing with the primary Toss Blue. (HSL: 185, 40%, 85%).
- Body and headline font: 'Inter' (sans-serif). Chosen for its clean lines, excellent legibility across various screen sizes, and modern appearance, fitting the requested '깔끔한 Sans-serif 계열' and the TDS aesthetic.
- Adopt a minimalist and modern icon style consistent with the Toss Design System, primarily using outline icons. Ensure map markers ('여유(초록)', '보통(노랑)', '붐빔(빨강)') are distinctly colored and clearly convey congestion status.
- Implement a map-centric layout where the interactive map occupies the majority of the screen space. Category tabs will be prominently positioned at the top for easy access. All buttons will feature significantly rounded corners (minimum 12px radius) for a soft and approachable feel, as per the design requirements.
- Integrate subtle yet smooth transitions for map interactions like panning and zooming, real-time marker updates, and user feedback upon reporting congestion status, ensuring a responsive and polished user experience.