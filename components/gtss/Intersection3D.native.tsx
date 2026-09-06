import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';

import { buildIntersectionScene } from '@/lib/gtss/scene3d';
import type { GtssFeed } from '@/lib/gtss/types';
import { fetchIntersectionMapData, type IntersectionMapData } from '@/lib/osm/mapData';

// When map data arrives after mount we remount the GLView (via `key`) so the
// scene is rebuilt with buildings included.

export interface Intersection3DProps {
    feed: GtssFeed;
}

// Native three.js view of the intersection rendered through expo-gl.
// Drag to orbit, pinch to zoom.
export default function Intersection3D({ feed }: Intersection3DProps) {
    const [mapData, setMapData] = useState<IntersectionMapData | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    // Spherical camera state shared between the PanResponder and the GL loop.
    const cameraState = useRef({ theta: Math.PI / 4, phi: Math.PI / 4.5, radius: 110 });
    const lastPinch = useRef<number | null>(null);

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

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                lastPinch.current = null;
            },
            onPanResponderMove: (event, gesture) => {
                const touches = event.nativeEvent.touches;
                if (touches.length >= 2) {
                    const [a, b] = touches;
                    const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
                    if (lastPinch.current != null && dist > 0) {
                        const scale = lastPinch.current / dist;
                        const s = cameraState.current;
                        s.radius = Math.min(300, Math.max(20, s.radius * scale));
                    }
                    lastPinch.current = dist;
                    return;
                }
                const s = cameraState.current;
                s.theta -= gesture.dx * 0.008;
                s.phi = Math.min(Math.PI / 2.1, Math.max(0.15, s.phi - gesture.dy * 0.006));
            },
            onPanResponderRelease: () => {
                lastPinch.current = null;
            },
        })
    ).current;

    // expo-gl's typings resolve to the web GLView class under this project's
    // moduleSuffixes, so the prop's parameter is typed as a plain
    // WebGLRenderingContext; at native runtime it is always an Expo context.
    const onContextCreate = (gl: WebGLRenderingContext) => {
        const expoGl = gl as ExpoWebGLRenderingContext;
        const renderer = new THREE.WebGLRenderer({
            canvas: {
                width: expoGl.drawingBufferWidth,
                height: expoGl.drawingBufferHeight,
                style: {},
                addEventListener: () => {},
                removeEventListener: () => {},
                clientHeight: expoGl.drawingBufferHeight,
            } as unknown as HTMLCanvasElement,
            context: gl,
            antialias: true,
        });
        renderer.setSize(expoGl.drawingBufferWidth, expoGl.drawingBufferHeight);
        renderer.setPixelRatio(1);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xbfd9e8);
        scene.fog = new THREE.Fog(0xbfd9e8, 220, 420);

        const camera = new THREE.PerspectiveCamera(50, expoGl.drawingBufferWidth / expoGl.drawingBufferHeight, 0.5, 1000);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.4);
        sun.position.set(80, 120, 40);
        scene.add(sun);

        scene.add(buildIntersectionScene({ feed, mapData }));

        const render = () => {
            requestAnimationFrame(render);
            const s = cameraState.current;
            camera.position.set(
                s.radius * Math.sin(s.phi) * Math.sin(s.theta),
                s.radius * Math.cos(s.phi),
                s.radius * Math.sin(s.phi) * Math.cos(s.theta)
            );
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
            expoGl.endFrameEXP();
        };
        render();
    };

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            <GLView key={mapData ? 'with-map' : 'no-map'} style={styles.gl} onContextCreate={onContextCreate} />
            {mapError ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{mapError}</Text>
                </View>
            ) : null}
            <View style={styles.hint}>
                <Text style={styles.hintText}>Drag to orbit · Pinch to zoom</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 320 },
    gl: { flex: 1 },
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
