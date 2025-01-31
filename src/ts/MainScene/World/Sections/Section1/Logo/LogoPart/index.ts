import * as THREE from 'three';
import * as ORE from 'ore-three';

import logoVert from './shaders/logo.vs';
import logoFrag from './shaders/logo.fs';

export class LogoPart {

	private commonUniforms: ORE.Uniforms;

	public mesh: THREE.Mesh;

	// position

	private basePosition: THREE.Vector3;
	private transformedPosition: THREE.Vector3;
	private transformedWorldPosition: THREE.Vector3;

	private velocity: THREE.Vector3;
	private time = 0.0;
	private offset: number = 0.0;

	public spTransform?: ORE.Transform;

	constructor( mesh: THREE.Mesh, offset: number, parentUniforms: ORE.Uniforms ) {

		this.offset = offset;
		this.time -= this.offset * 5.0;

		this.commonUniforms = ORE.UniformsLib.mergeUniforms( parentUniforms, {} );

		this.mesh = mesh;
		let baseMaterial = mesh.material as THREE.MeshStandardMaterial;

		let mat = new THREE.ShaderMaterial( {
			vertexShader: logoVert,
			fragmentShader: logoFrag,
			uniforms: ORE.UniformsLib.mergeUniforms( this.commonUniforms, {
				uColor: {
					value: baseMaterial.emissive.convertLinearToSRGB()
				},
				uMatCapTex: window.gManager.assetManager.getTex( 'matCap' ),
				num: {
					value: 1.0 - this.offset
				},
				// New PBR-related uniforms
				uMetalness: { value: 0.7 },    // Adjust for metallic look
				uRoughness: { value: 0.2 },    // Lower = smoother
				uGlossiness: { value: 0.8 },   // Higher = shinier
				uReflection: { value: 0.6 },   // Higher = more reflective
			} ),
			side: THREE.DoubleSide
		} );

		this.mesh.material = mat;

		this.basePosition = this.mesh.position.clone();
		this.transformedPosition = this.basePosition.clone();
		this.transformedWorldPosition = this.mesh.getWorldPosition( new THREE.Vector3() );
		this.velocity = new THREE.Vector3();

	}


	// Method to update material properties
	public updateMaterialProperties(properties: {
		metalness?: number;
		roughness?: number;
		glossiness?: number;
		reflection?: number;
	}) {
		const material = this.mesh.material as THREE.ShaderMaterial;
		
		if (properties.metalness !== undefined) {
			material.uniforms.uMetalness.value = properties.metalness;
		}
		if (properties.roughness !== undefined) {
			material.uniforms.uRoughness.value = properties.roughness;
		}
		if (properties.glossiness !== undefined) {
			material.uniforms.uGlossiness.value = properties.glossiness;
		}
		if (properties.reflection !== undefined) {
			material.uniforms.uReflection.value = properties.reflection;
		}
	}


	public update( deltaTime: number ) {

		this.time += deltaTime;

		this.velocity.add( this.transformedPosition.clone().sub( this.mesh.position ).multiplyScalar( deltaTime ) );
		this.velocity.y += Math.sin( this.time ) * 0.002;
		this.velocity.multiplyScalar( 0.9 );

		this.mesh.position.add( this.velocity );

	}

	public hover( args: ORE.TouchEventArgs, camera: THREE.PerspectiveCamera ) {

		let screenPos = this.transformedWorldPosition.clone().applyMatrix4( camera.matrixWorldInverse ).applyMatrix4( camera.projectionMatrix );

		// @ts-ignore
		let d = args.screenPosition.distanceTo( new THREE.Vector2( screenPos.x, screenPos.y ) );

		this.velocity.add( new THREE.Vector3( args.delta.x, - args.delta.y ).multiplyScalar( 0.001 * Math.max( 0.0, 1.0 - d * 2.0 ) ) );

	}

	public resize( info: ORE.LayerInfo ) {

		if ( this.spTransform ) {

			let transformPosition = this.spTransform.position;

			if ( transformPosition ) {

				this.transformedPosition.copy( this.basePosition.clone().add( transformPosition.clone().multiplyScalar( info.size.portraitWeight ) ) );

				let parent = this.mesh.parent || this.mesh;
				this.transformedWorldPosition = this.transformedPosition.clone().applyMatrix4( parent.matrixWorld );

			}

		}

	}

}
