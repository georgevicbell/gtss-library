import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildIntersectionScene } from '@/lib/gtss/scene3d';
import type { GtssFeed } from '@/lib/gtss/types';
import { fetchIntersectionMapData, type IntersectionMapData } from '@/lib/osm/mapData';

export interface Intersection3DProps {
    feed: GtssFeed;
}

// Interactive three.js view of the intersection: OSM roads/buildings plus the
// GTSS configuration (approach lanes, crosswalks, detectors, signal heads).
export default function Intersection3D({ feed }: Intersection3DProps) {
    const containerRef = useRef<View | null>(null);
    const [mapData, setMapData] = useState<IntersectionMapData | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    const latitude = feed.signal.latitude;
    const longitude = feed.signal.longitude;

    useEffect(() => {
        const controller = new AbortController();
        fetchIntersectionMapData(latitude, longitude, 130, controller.signal)
            .then((data) => {
                setMapData(data);
                setMapError(null);
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                setMapData(null);
                setMapError('Could not load 3D map data. Showing configuration only.');
            });
        return () => controller.abort();
    }, [latitude, longitude]);

    useEffect(() => {
        const container = containerRef.current as unknown as HTMLDivElement | null;
        if (!container) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);
        renderer.domElement.style.display = 'block';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbfd9e8);
        scene.fog = new THREE.Fog(0xbfd9e8, 220, 420);

        const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1000);
        camera.position.set(60, 70, 60);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.maxPolarAngle = Math.PI / 2.05;
        controls.minDistance = 15;
        controls.maxDistance = 300;
        controls.enableDamping = true;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(80, 120, 40);
        sun.castShadow = true;
        sun.shadow.camera.left = -160;
        sun.shadow.camera.right = 160;
        sun.shadow.camera.top = 160;
        sun.shadow.camera.bottom = -160;
        sun.shadow.mapSize.set(2048, 2048);
        scene.add(sun);

        const content = buildIntersectionScene({ feed, mapData });
        scene.add(content);

        const resize = () => {
            const width = container.clientWidth || 1;
            const height = container.clientHeight || 1;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);

        let frame = 0;
        const render = () => {
            frame = requestAnimationFrame(render);
            controls.update();
            renderer.render(scene, camera);
        };
        render();

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            controls.dispose();
            scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    const material = obj.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(material)) material.forEach((m) => m.dispose());
                    else material.dispose();
                }
            });
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [feed, mapData]);

    return (
        <View style={styles.container}>
            <View ref={containerRef} style={styles.canvas} />
            {mapError ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{mapError}</Text>
                </View>
            ) : null}
            <View style={styles.hint}>
                <Text style={styles.hintText}>Drag to orbit · Scroll to zoom</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 320 },
    canvas: { flex: 1 },
    errorBanner: {
        position: 'absolute',
        top: 8,
        alignSelf: 'center',
        backgroundColor: '#b00020',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    errorText: { color: '#fff', fontSize: 12 },
    hint: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    hintText: { color: '#fff', fontSize: 11 },
});
