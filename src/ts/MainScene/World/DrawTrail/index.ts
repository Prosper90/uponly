import * as THREE from 'three';
import * as ORE from 'ore-three';

import drawTrailVert from './shaders/drawTrail.vs';
import drawTrailFrag from './shaders/drawTrail.fs';

import computePosition from './shaders/trailComputePosition.glsl';
import { Pencil } from './Pencil';
import { Sec1Pointer } from './Sec1Pointer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

declare interface Kernels{
    position: ORE.GPUComputationKernel
}

declare interface Datas{
    position: ORE.GPUcomputationData
}

export class DrawTrail extends THREE.Mesh {

	private animator: ORE.Animator;

	private commonUniforms: ORE.Uniforms;
	private meshUniforms: ORE.Uniforms;

	private renderer: THREE.WebGLRenderer;

	private radialSegments: number;
	private heightSegments: number;
	private positionAttr: THREE.BufferAttribute;

	private gCon: ORE.GPUComputationController;
	private kernels: Kernels;
	private datas: Datas;

	//new detail
	private manager: THREE.LoadingManager = new THREE.LoadingManager();

	// state

	private cursorPos: THREE.Vector3 = new THREE.Vector3();
	private cursorPosDelay: THREE.Vector3 = new THREE.Vector3();

	private assets: THREE.Object3D;

	// children

	private childrenWrapper: THREE.Object3D;
	private pencil: Pencil;
	private pointer: Sec1Pointer | null = null;

	constructor( renderer: THREE.WebGLRenderer, assets: THREE.Object3D, parentUniforms: ORE.Uniforms, manager?: THREE.LoadingManager) {

		let radialSegments = 9;
		let heightSegments = 128;

		let uni = ORE.UniformsLib.mergeUniforms( parentUniforms, {
			uCursorPos: {
				value: new THREE.Vector3( 0, 0 )
			},
			uPosDataTex: {
				value: null
			},
			uDataSize: {
				value: new THREE.Vector2()
			},
			uMaterial: window.gManager.animator.add( {
				name: 'trailMaterial',
				initValue: [ 1.0, 0.0, 0.0, 0.0, 0.0, 0.0 ],
			} ),
		} );

		let meshUniforms = ORE.UniformsLib.mergeUniforms( THREE.UniformsUtils.clone( THREE.UniformsLib.lights ), uni, {
			uSceneTex: {
				value: null
			},
			uWinResolution: {
				value: new THREE.Vector2()
			},
		} );

		let radius = 0.05;

		let geo = new THREE.CylinderGeometry( radius, radius, 1.0, radialSegments, heightSegments, true );
		let mat = new THREE.ShaderMaterial( {
			vertexShader: drawTrailVert,
			fragmentShader: drawTrailFrag,
			uniforms: meshUniforms,
			lights: true,
			transparent: false
		} );

		let computeUVArray = [];

		for ( let i = 0; i <= heightSegments; i ++ ) {

			for ( let j = 0; j <= radialSegments; j ++ ) {

				computeUVArray.push(
					i / ( heightSegments ), 0
				);

			}

		}

		geo.setAttribute( 'computeUV', new THREE.BufferAttribute( new Float32Array( computeUVArray ), 2 ), );
		geo.getAttribute( 'position' ).applyMatrix4( new THREE.Matrix4().makeRotationX( Math.PI / 2 ) );
		geo.getAttribute( 'normal' ).applyMatrix4( new THREE.Matrix4().makeRotationX( Math.PI / 2 ) );

		super( geo, mat );

		this.manager = manager ?? new THREE.LoadingManager();

		this.assets = assets;

		this.castShadow = true;

		this.animator = window.gManager.animator;

		this.renderOrder = 999;

		this.renderer = renderer;
		this.commonUniforms = uni;
		this.meshUniforms = meshUniforms;
		this.radialSegments = radialSegments;
		this.heightSegments = heightSegments;

		this.positionAttr = this.geometry.getAttribute( 'position' ) as THREE.BufferAttribute;

		/*-------------------------------
			GPU Controller
		-------------------------------*/

		let gpuCommonUniforms = ORE.UniformsLib.mergeUniforms( this.commonUniforms, {
		} );

		this.gCon = new ORE.GPUComputationController( this.renderer, new THREE.Vector2( heightSegments, 1 ) );

		this.commonUniforms.uDataSize.value.copy( this.gCon.dataSize );

		// create computing position kernel

		let posUni = ORE.UniformsLib.mergeUniforms( gpuCommonUniforms, {
			uPosDataTex: { value: null },
			uNoiseTex: window.gManager.assetManager.getTex( 'noise' )
		} );

		let posKernel = this.gCon.createKernel( {
			fragmentShader: computePosition,
			uniforms: posUni
		} );

		// matomeru

		this.kernels = {
			position: posKernel,
		};

		this.datas = {
			position: this.gCon.createData()
		};

		/*-------------------------------
			Children
		-------------------------------*/

		this.childrenWrapper = new THREE.Object3D();
		this.add( this.childrenWrapper );

		this.pencil = new Pencil( this.commonUniforms );
		this.pencil.position.y = 0.1;
		this.childrenWrapper.add( this.pencil );
        
		const loader = new GLTFLoader(this.manager);
		loader.load('./assets/scene/SM_Candle_Jump.glb', (gltf) => {
			this.pointer = new Sec1Pointer( gltf.scene.getObjectByName( 'Candle' ) as THREE.Mesh, this.commonUniforms );
			this.childrenWrapper.add( this.pointer.mesh );
		})

	}

	public setSceneTex( texture: THREE.Texture ) {

		this.meshUniforms.uSceneTex.value = texture;

	}

	private pointerDirection: THREE.Vector2 = new THREE.Vector2();

	public update( deltaTime: number ) {

		this.kernels.position.uniforms.uPosDataTex.value = this.datas.position.buffer.texture;
		this.gCon.compute( this.kernels.position, this.datas.position );

		this.meshUniforms.uPosDataTex.value = this.datas.position.buffer.texture;

		// calc pos
		let diff = this.cursorPos.clone().sub( this.cursorPosDelay );
		diff.multiplyScalar( deltaTime * 13.0 );

		this.cursorPosDelay.add( diff );

		this.commonUniforms.uCursorPos.value.copy( this.cursorPosDelay );
		this.childrenWrapper.position.copy( this.cursorPosDelay );

		this.pencil.rotation.z = diff.x * 0.7;
		this.pencil.rotation.x = - diff.z * 0.5;

		// pointer
		let diffVec2 = new THREE.Vector2( diff.x, diff.y );
		this.pointerDirection.lerp( diffVec2, Math.min( 1.0, diffVec2.length() * 10.0 ) );
		if(this.pointer)
		this.pointer.mesh.rotation.z = Math.atan2( this.pointerDirection.y, this.pointerDirection.x ) - Math.PI / 2;

	}

	public updateCursorPos( worldPos: THREE.Vector3, raycasterWorldPos: THREE.Vector3 ) {

		let localPos = this.worldToLocal( worldPos.clone() ).lerp( raycasterWorldPos, this.animator.get<number[]>( 'trailMaterial' )![ 3 ] );

		this.cursorPos.copy( localPos );

	}

	public changeMaterial( sectionIndex: number ) {

		let mat = [ 0, 0, 0, 0, 0, 0 ];

		mat[ sectionIndex ] = 1.0;

		this.animator.animate( 'trailMaterial', mat );

	}

	public resize( info: ORE.LayerInfo ) {

		this.meshUniforms.uWinResolution.value.copy( info.size.canvasPixelSize );

	}

}
